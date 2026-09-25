// Multiplayer presence. Framework-free (no React import) — this is the ONLY
// module that talks to the Colyseus server (../../Age-every-click-backend's
// IslandRoom). Exactly like systems/bloxity.js, every path through here is
// built so a slow, asleep, or absent server leaves the game fully playable
// solo: nothing here blocks gameplay, and the scene never waits on a socket.
//
// Ported down from Ice-Skate's own systems/net.js, trimmed of position/avatar
// relay and remote-player rendering — this template has no remote-player
// component (components/Player.jsx only ever draws the local player), so the
// server's `move`/`setAvatar` messages are simply never sent. What's left is
// exactly what components/IslandLandmarks.jsx's two leaderboard boards (Top
// Coins/Top Age) and cross-session save/load need: identity, live stats,
// durable progress, and the merged global leaderboard.
import { authState, subscribeAuth, getStableUserId } from './bloxity.js'
import { useGameStore } from '../store/useGameStore.js'
import { claimLocalFreeSpin } from './freeSpin.js'
import {
  SERVER_URL,
  ROOM_NAME,
  JOIN_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  SOLO_NOTICE_AFTER_ATTEMPT,
  STATS_RESEND_DEBOUNCE_MS,
  PROGRESS_RESEND_DEBOUNCE_MS,
  USERNAME_WAIT_MS,
} from '../data/net.js'

// --- Public state -----------------------------------------------------------
// Coarse connection status the HUD renders (components/hud/NetStatus.jsx):
//   'idle'       — not started / torn down / no server configured
//   'connecting' — a join or reconnect attempt is in flight
//   'solo'       — between retry attempts; the game is single-player right now
//   'online'     — attached to a room
export const netState = {
  status: 'idle',
  attempt: 0, // failed attempts since the last successful attach
  playerCount: 0, // total players in the room, including us
  everConnected: false, // true once we have attached at least once this session
  error: null, // last error string, for diagnostics
}

// --- Listeners --------------------------------------------------------------
const listeners = new Set()

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  netState.attempt = attempt
  for (const fn of listeners) {
    try {
      fn(netState)
    } catch {
      // A broken subscriber must not wedge the netcode.
    }
  }
}

function setStatus(status) {
  netState.status = status
  emit()
}

// --- Connection machine -------------------------------------------------
let sdkModule = null
let client = null
let room = null
let selfId = ''
let started = false
let stopped = true
let connecting = false
let attempt = 0
let retryTimer = 0

// Server's periodic merge of "every account that ever saved to Mongo" +
// "everyone online right now" (server IslandRoom.ts's refreshLeaderboard()),
// one array per stat. Empty until the first 'leaderboard' message arrives
// (fresh connect, offline/solo play, or no server) — getLeaderboard() below
// degrades to a self-only row in that case, same "never blocks gameplay"
// stance as the rest of this file.
let globalLeaderboard = { speed: [], coins: [], rebirth: [] }

async function loadSdk() {
  if (!sdkModule) sdkModule = await import('@colyseus/sdk')
  return sdkModule
}

function currentUsername() {
  // Signed-in account, else Bloxity's generated guest identity ("bear5" …),
  // matching the HUD identity chip. Plain "Guest" only if neither exists.
  const u = authState.user || authState.guest
  const name = u && (u.displayName || u.username || u.name)
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 64) : 'Guest'
}

// --- Stats sync ---------------------------------------------------------
// Our own live speed/coins/rebirth (store/useGameStore.js), pushed to the
// room so the Top Coins/Top Age boards can rank currently-connected players.
function statsPayload() {
  const s = useGameStore.getState()
  return { speed: s.speed, coins: s.coins, rebirth: s.rebirth }
}

let statsResendTimer = 0

function sendStatsNow() {
  if (!room) return
  try {
    room.send('stats', statsPayload())
  } catch {
    // Socket mid-close — the next attach re-seeds via attachRoom() anyway.
  }
}

// Schedule once, ride out further triggers until it fires — an
// actively-clicking player can gain Age many times a second, and a
// leaderboard only needs a roughly-current rank, not a per-click packet.
function scheduleStatsResend() {
  if (statsResendTimer) return
  statsResendTimer = setTimeout(() => {
    statsResendTimer = 0
    sendStatsNow()
  }, STATS_RESEND_DEBOUNCE_MS)
}

// Last speed/coins/rebirth we scheduled a resend for — useGameStore.subscribe
// fires on ANY store change (no subscribeWithSelector middleware), so this
// filters out the unrelated ones (buying a hex pad, ...) rather than
// scheduling a pointless resend for every one of them.
let lastScheduledStats = { speed: undefined, coins: undefined, rebirth: undefined }

function onLocalStoreChange(state) {
  if (
    state.speed !== lastScheduledStats.speed ||
    state.coins !== lastScheduledStats.coins ||
    state.rebirth !== lastScheduledStats.rebirth
  ) {
    lastScheduledStats = { speed: state.speed, coins: state.coins, rebirth: state.rebirth }
    scheduleStatsResend()
  }
}

// --- Progress sync (persisted save) --------------------------------------
// The durable half of store/useGameStore.js — speed/rebirth/coins plus owned
// and equipped hex pads/auras, and owned Age Machines — pushed to a
// signed-in player's own document in the server's Mongo `players` collection
// (server src/db.ts, IslandRoom.ts's `saveProgress`). A guest has no stable
// id (systems/bloxity.js getStableUserId(), which this gates on) and this
// simply never sends for one — same "nowhere durable to live" stance as the
// rest of the SDK integration.
function progressPayload() {
  const s = useGameStore.getState()
  return {
    speed: s.speed,
    rebirth: s.rebirth,
    coins: s.coins,
    ownedHexPads: Array.from(s.ownedHexPads),
    equippedHexPad: s.equippedHexPad,
    ownedAuras: Array.from(s.ownedAuras),
    equippedAura: s.equippedAura,
    ownedAgeMachines: Array.from(s.ownedAgeMachines),
    spins: s.spins,
    speedCoil: s.speedCoil,
    wheelSpins: s.wheelSpins,
  }
}

let progressResendTimer = 0

// No client-side identity gate here on purpose: the ROOM is the authority
// on whether this session is allowed to persist (IslandRoom.ts's `userIds`
// map, set by `identify`/join options), so a send that arrives just after a
// logout simply lands as a no-op there instead of racing this module's own
// view of authState. sendIdentityNow() below relies on exactly this to
// flush a final save under the OLD id before the room forgets it.
function sendProgressNow() {
  if (!room) return
  try {
    room.send('saveProgress', progressPayload())
  } catch {
    // Socket mid-close — teardown() already tried to flush before this point.
  }
}

function scheduleProgressResend() {
  if (progressResendTimer) return
  progressResendTimer = setTimeout(() => {
    progressResendTimer = 0
    sendProgressNow()
  }, PROGRESS_RESEND_DEBOUNCE_MS)
}

// Cheap snapshot string for change detection — same purpose as
// lastScheduledStats above, just covering the extra owned/equipped fields
// stats doesn't carry.
let lastScheduledProgress = ''

function onLocalStoreChangeProgress(state) {
  if (!getStableUserId()) return
  const snap = JSON.stringify([
    state.speed,
    state.rebirth,
    state.coins,
    state.equippedHexPad,
    state.equippedAura,
    state.ownedHexPads.size,
    state.ownedAuras.size,
    state.ownedAgeMachines.size,
    state.spins,
    state.speedCoil,
    state.wheelSpins,
  ])
  if (snap !== lastScheduledProgress) {
    lastScheduledProgress = snap
    scheduleProgressResend()
  }
}

// Applied at most once per page session: the FIRST successful attach's
// `progress` message is the real load from this player's save. A later
// reattach (a full drop + fresh joinOrCreate, not the SDK's own buffered
// reconnection) would otherwise re-fetch a possibly-stale Mongo snapshot and
// clobber whatever the player did locally during the blip — our own store is
// already the source of truth by then, and the next scheduled saveProgress
// writes it back over Mongo regardless.
let hydratedFromServer = false

// --- Lucky Wheel free spin --------------------------------------------------
// The daily free spin's 24h cooldown is checked and stamped by the SERVER for a
// signed-in player (IslandRoom.ts's claimFreeSpin), so it survives reloads and
// can't be skipped by changing the device clock. Resolves { ok, nextInMs,
// reason? } — nextInMs is the cooldown as a duration. A guest, or a server
// with no Mongo (reason 'unavailable'), falls back to systems/freeSpin.js's
// local timer; a signed-in player who can't reach the server just gets
// reason 'offline' rather than a free local claim that would sit outside the
// server's record.
let pendingFreeSpin = null
const FREE_SPIN_REPLY_TIMEOUT_MS = 5000

export async function requestFreeSpin() {
  if (!getStableUserId()) return claimLocalFreeSpin()
  if (!room) return { ok: false, reason: 'offline', nextInMs: 0 }
  if (pendingFreeSpin) return { ok: false, reason: 'busy', nextInMs: 0 }

  let reply
  try {
    reply = await withTimeout(
      new Promise((resolve) => {
        pendingFreeSpin = resolve
        room.send('claimFreeSpin', {})
      }),
      FREE_SPIN_REPLY_TIMEOUT_MS,
      'freeSpin timeout',
    )
  } catch {
    pendingFreeSpin = null
    return { ok: false, reason: 'offline', nextInMs: 0 }
  }
  return reply.reason === 'unavailable' ? claimLocalFreeSpin() : reply
}

// --- Identity sync (login/logout mid-session) ----------------------------
// join options only carry whatever username/userId was true the instant the
// socket opened. Bloxity auth routinely settles AFTER that (or changes later
// via login/logout without a page reload), so without this, IslandRoom.ts's
// userIds map would stay stuck on whatever was true at join forever.
let lastIdentity = { userId: '', username: '' }

function sendIdentityNow() {
  if (!room) return
  const prevUserId = lastIdentity.userId
  const userId = getStableUserId()
  const username = currentUsername()
  if (userId === prevUserId && username === lastIdentity.username) return

  // Logging out (or switching accounts) — flush this session's progress
  // under the OLD id before the room forgets it below; once it does,
  // saveProgress can no longer reach that document.
  if (prevUserId && prevUserId !== userId) sendProgressNow()
  // A freshly-signed-in id gets its saved doc hydrated again, same as a
  // brand-new join — see hydratedFromServer's own comment.
  if (userId && userId !== prevUserId) hydratedFromServer = false
  // Logging out to a guest: nothing durable backs a guest session, so the
  // old account's stats shouldn't carry over and read as free progress on
  // the anonymous session that follows them.
  if (prevUserId && !userId) useGameStore.getState().resetProgress()

  lastIdentity = { userId, username }
  try {
    room.send('identify', { userId, username })
  } catch {
    // Socket mid-close — the next attach re-seeds via join options anyway.
  }
}

// Resolve once auth has settled, so a signed-in player joins under their real
// name. Bounded — a blocked SDK never settles and must not hold the connect.
function waitForAuth(ms) {
  if (authState.ready) return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(t)
      off()
      resolve()
    }
    const off = subscribeAuth((s) => {
      if (s.ready) finish()
    })
    const t = setTimeout(finish, ms)
  })
}

function withTimeout(promise, ms, label) {
  let t
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t))
}

async function connect() {
  if (stopped || connecting || room) return
  connecting = true
  clearTimeout(retryTimer)
  retryTimer = 0
  setStatus('connecting')

  try {
    const mod = await loadSdk()
    if (stopped) return
    if (!client) client = new mod.Client(SERVER_URL)

    // The @colyseus/sdk Room has its own automatic reconnection (buffered
    // messages, exponential backoff) that transparently rides out a brief
    // socket drop. This connect() is only reached for the FIRST join and for
    // the outer fallback after that built-in reconnection has exhausted its
    // retries (room.onLeave). So a plain joinOrCreate is all that's needed
    // here; JOIN_TIMEOUT_MS covers a cold host boot.
    const joined = await withTimeout(
      client.joinOrCreate(ROOM_NAME, {
        username: currentUsername(),
        // Empty string for a guest — IslandRoom.ts's onJoin treats a falsy
        // userId as "nothing to load/save", same as every other field here.
        userId: getStableUserId(),
      }),
      JOIN_TIMEOUT_MS,
      'join timed out',
    )

    if (stopped) {
      try {
        joined.leave()
      } catch {
        /* nothing to clean up */
      }
      return
    }
    attachRoom(joined)
  } catch (err) {
    connecting = false
    attempt += 1
    netState.error = String((err && err.message) || err)
    if (stopped) return
    scheduleRetry()
  }
}

function scheduleRetry() {
  if (stopped || room || retryTimer) return
  // Between attempts the game IS single-player. Say so plainly once a cold
  // start is the likely cause; keep retrying underneath either way.
  setStatus(attempt >= SOLO_NOTICE_AFTER_ATTEMPT || netState.everConnected ? 'solo' : 'connecting')
  const i = Math.min(Math.max(attempt - 1, 0), RETRY_BACKOFF_MS.length - 1)
  retryTimer = setTimeout(() => {
    retryTimer = 0
    connect()
  }, RETRY_BACKOFF_MS[i])
}

function recount() {
  const n = room && room.state && room.state.players ? room.state.players.size : 0
  if (n !== netState.playerCount) {
    netState.playerCount = n
    emit()
  }
}

function attachRoom(joined) {
  room = joined
  connecting = false
  attempt = 0
  selfId = joined.sessionId
  netState.everConnected = true
  netState.error = null

  // Fires only once the SDK's own reconnection has given up (or on a
  // consented leave from teardown()). That's our cue to drop to solo and run
  // the slower outer retry loop.
  room.onLeave(() => handleLeave())
  room.onError((code, message) => {
    netState.error = message || `error ${code}`
  })

  // The saved doc for our own Bloxity user id (IslandRoom.ts's onJoin ->
  // loadProgress()), sent once right after this join resolves. See
  // hydratedFromServer's own comment for why only the FIRST attach applies it.
  room.onMessage('progress', (msg) => {
    if (hydratedFromServer) return
    hydratedFromServer = true
    useGameStore.getState().hydrate(msg)
  })

  // Reply to requestFreeSpin() below.
  room.onMessage('freeSpin', (msg) => {
    const resolve = pendingFreeSpin
    pendingFreeSpin = null
    if (resolve) resolve(msg || { ok: false, reason: 'error', nextInMs: 0 })
  })

  // The merged all-time + online leaderboard (server IslandRoom.ts's
  // refreshLeaderboard(), broadcast every 15s). Re-render on every update via
  // emit() — not per frame, same convention as every other emit() site here.
  room.onMessage('leaderboard', (msg) => {
    globalLeaderboard = msg || { speed: [], coins: [], rebirth: [] }
    emit()
  })

  // The roster only changes on join/leave (no `move` relay in this
  // template), so listening for those directly is enough to keep
  // netState.playerCount current — no per-frame polling needed.
  if (room.state && room.state.players) {
    room.state.players.onAdd(() => recount())
    room.state.players.onRemove(() => recount())
  }

  // Same reasoning as scheduleStatsResend: a fresh session starts every
  // field at its schema default (0), so a rejoin needs its current
  // speed/coins/rebirth re-stated immediately rather than waiting for the
  // next store change.
  sendStatsNow()
  // The join options already carried whatever identity was true the instant
  // we connected — seed lastIdentity to match so sendIdentityNow() (fired
  // from the subscribeAuth callback below) only resends on a REAL change
  // after this point, not an immediate redundant duplicate of the join.
  lastIdentity = { userId: getStableUserId(), username: currentUsername() }

  recount()
  setStatus('online')
}

function handleLeave() {
  room = null
  selfId = ''
  connecting = false
  netState.playerCount = 0
  // Stale rows from the last session shouldn't linger on the boards while
  // we're disconnected/retrying; the next attach's first broadcast refills this.
  globalLeaderboard = { speed: [], coins: [], rebirth: [] }

  if (stopped) return
  attempt = 0
  scheduleRetry()
}

// --- Public lifecycle -------------------------------------------------
let offStats = null
let offProgress = null
let offIdentity = null

export function init() {
  if (started) return
  started = true
  stopped = false
  // No server configured for this build (see data/net.js's SERVER_URL_MAIN)
  // — stay 'idle' forever, exactly like the old stub. Every other export
  // below already no-ops without a room, so nothing downstream needs to
  // change the day a real URL is configured.
  if (!SERVER_URL) return

  // Our own speed/coins/rebirth -> the room, debounced (see
  // scheduleStatsResend). A no-op while offline; the next attach re-seeds
  // via sendStatsNow().
  if (!offStats) offStats = useGameStore.subscribe(onLocalStoreChange)
  // Our own durable save -> the room, debounced (see scheduleProgressResend).
  // A no-op for a guest or while offline; see progressPayload()'s own comment.
  if (!offProgress) offProgress = useGameStore.subscribe(onLocalStoreChangeProgress)
  // Login/logout/account-switch -> the room, immediately (see
  // sendIdentityNow()'s own comment for why this exists). subscribeAuth also
  // fires on friends/balance loads, not just identity changes;
  // sendIdentityNow()'s own diff check is what filters those out.
  if (!offIdentity) offIdentity = subscribeAuth(() => sendIdentityNow())
  waitForAuth(USERNAME_WAIT_MS).then(() => {
    if (!stopped) connect()
  })
}

export function teardown() {
  stopped = true
  started = false
  clearTimeout(retryTimer)
  retryTimer = 0
  clearTimeout(statsResendTimer)
  statsResendTimer = 0
  clearTimeout(progressResendTimer)
  progressResendTimer = 0
  if (offStats) {
    offStats()
    offStats = null
  }
  if (offProgress) {
    offProgress()
    offProgress = null
  }
  if (offIdentity) {
    offIdentity()
    offIdentity = null
  }
  // Final best-effort save before the socket closes — a page unload can't
  // wait on PROGRESS_RESEND_DEBOUNCE_MS, and room.send() is fire-and-forget
  // (no ack needed) so this never delays the leave() right after it.
  sendProgressNow()
  if (room) {
    try {
      // Stop the SDK from trying to reconnect a socket we are deliberately
      // closing on the way out.
      if (room.reconnection) room.reconnection.enabled = false
      room.leave()
    } catch {
      /* page is going away */
    }
  }
  room = null
  connecting = false
  globalLeaderboard = { speed: [], coins: [], rebirth: [] }
  netState.playerCount = 0
  setStatus('idle')
}

// Manual "Retry" from the HUD banner. Collapses the backoff and tries now.
export function retryNow() {
  if (!SERVER_URL) return
  if (stopped) {
    stopped = false
    started = true
  }
  clearTimeout(retryTimer)
  retryTimer = 0
  attempt = 0
  connect()
}

// --- Leaderboard --------------------------------------------------------
// Top `limit` players by `stat` ('speed' | 'coins' | 'rebirth' — any
// store/useGameStore.js field), local player included, highest first. Our
// own row always comes straight off the live store (no round trip needed
// for our own numbers, and it's always the freshest value there is); every
// other row comes from globalLeaderboard (server IslandRoom.ts's
// refreshLeaderboard() — every account that has EVER saved to Mongo, merged
// with everyone online right now, logged in or guest). Offline/solo, or
// before the first broadcast arrives, globalLeaderboard[stat] is empty and
// this degrades to just our own row — same "never blocks, never intrudes"
// stance as the rest of this file.
export function getLeaderboard(stat, limit, getState) {
  const state = getState ? getState() : useGameStore.getState()
  const selfRow = {
    id: selfId || 'self',
    name: currentUsername(),
    value: Number(state[stat]) || 0,
    isSelf: true,
  }
  // The server already excludes our own account from this list (an online
  // session's live value replaces its own Mongo doc there), but filtering by
  // id here too is cheap insurance against ever showing ourselves twice.
  const others = (globalLeaderboard[stat] || [])
    .filter((row) => row.id !== selfId)
    .map((row) => ({ id: row.id, name: row.name || 'Player', value: Number(row.value) || 0, isSelf: false }))

  const rows = [selfRow, ...others]
  rows.sort((a, b) => b.value - a.value)
  return rows.slice(0, limit)
}
