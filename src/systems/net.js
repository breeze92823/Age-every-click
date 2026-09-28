// Multiplayer presence. Framework-free (no React import) — this is the ONLY
// module that talks to the Colyseus server (../../Age-every-click-backend's
// IslandRoom). Exactly like systems/bloxity.js, every path through here is
// built so a slow, asleep, or absent server leaves the game fully playable
// solo: nothing here blocks gameplay, and the scene never waits on a socket.
//
// Ported down from Ice-Skate's own systems/net.js. Restores position/avatar
// relay and remote-player rendering: reportLocal() below (called every frame
// from components/GameLoop.jsx) throttles the local player's position/yaw/
// moveBlend out over `move`, sendAvatarNow() mirrors the same
// gender/outfit/equipped/proportions components/Player.jsx renders locally
// out over `setAvatar`, and subscribeRoster() lets components/
// RemotePlayers.jsx mount one character per other connected session and read
// its live position/avatar straight off the synced PlayerState instance.
// Also covers what components/IslandLandmarks.jsx's two leaderboard boards
// (Top Coins/Top Age) and cross-session save/load need: identity, live
// stats, durable progress, and the merged global leaderboard.
import {
  authState,
  subscribeAuth,
  getStableUserId,
  getDisplayName,
  getEquippedAvatar,
  getProportions,
  onAvatarChanged,
  onProportionsChanged,
} from './bloxity.js'
import { DEV_MODE } from '../data/bloxity.js'
import { useGameStore } from '../store/useGameStore.js'
import { claimLocalFreeSpin } from './freeSpin.js'
import { player } from './playerState.js'
import { outfitForLevel } from './defaultCharacter.js'
import {
  SERVER_URL,
  ROOM_NAME,
  JOIN_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  SOLO_NOTICE_AFTER_ATTEMPT,
  STATS_RESEND_DEBOUNCE_MS,
  PROGRESS_RESEND_DEBOUNCE_MS,
  MOVE_SEND_INTERVAL_MS,
  USERNAME_WAIT_MS,
  PROGRESS_KNOWN_TIMEOUT_MS,
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

// --- Remote players -----------------------------------------------------
// sessionId -> the OTHER player's live PlayerState schema instance (never
// our own — see the selfId filter everywhere this is populated). Colyseus
// patches each instance's fields in place as updates arrive, so a consumer
// can read e.g. `p.x`/`p.avatar` straight off it every frame with no
// callback needed; only the add/remove event itself needs one (below),
// since a rendering component (components/RemotePlayers.jsx) needs to know
// when to mount/unmount a character, not just when its fields change.
const remotePlayers = new Map()
const rosterListeners = new Set()

function notifyRosterAdd(sessionId, p) {
  for (const l of rosterListeners) {
    try {
      l.onAdd(sessionId, p)
    } catch {
      // A broken subscriber must not wedge the netcode.
    }
  }
}

function notifyRosterRemove(sessionId) {
  for (const l of rosterListeners) {
    try {
      l.onRemove(sessionId)
    } catch {
      // A broken subscriber must not wedge the netcode.
    }
  }
}

// components/RemotePlayers.jsx's one hook into this module: mount a
// character per other connected session. Replays the current roster
// immediately so a subscriber that mounts after we're already online (the
// common case — React mounts after init()'s connect() has resolved) doesn't
// miss whoever's already here.
export function subscribeRoster(onAdd, onRemove) {
  const entry = { onAdd, onRemove }
  rosterListeners.add(entry)
  for (const [sessionId, p] of remotePlayers) onAdd(sessionId, p)
  return () => rosterListeners.delete(entry)
}

// components/IslandLandmarks.jsx's BuyButton: true while some OTHER
// connected session's relayed avatar (see avatarPayload's ridingAgeMachine
// field) says they're riding this Age Machine `index`. Keeps a machine to one
// rider at a time without any backend change — see avatarPayload's own
// comment for the race-window caveat this accepts.
export function isAgeMachineTakenByRemote(index) {
  for (const p of remotePlayers.values()) {
    let avatar
    try {
      avatar = JSON.parse(p.avatar || '')
    } catch {
      continue // mid-update or malformed payload — treat as not riding
    }
    if (avatar && avatar.ridingAgeMachine === index) return true
  }
  return false
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
  return getDisplayName()
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
    tutorialStep: s.tutorialStep,
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
    state.tutorialStep,
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

// --- New-vs-returning player signal (systems/tutorial.js) -------------------
// Resolves exactly once, as soon as we know whether this session has an
// existing saved doc: true the instant the `progress` message actually
// arrives below (IslandRoom.ts's loadProgress only ever sends one when a doc
// was found — a brand-new account just leaves the client on defaults and
// sends nothing), false once we've given up waiting for one (see
// PROGRESS_KNOWN_TIMEOUT_MS and the confirmed-guest check in init() below).
// systems/tutorial.js uses this to skip the first-run onboarding entirely for
// anyone who already has progress, without ever blocking a genuinely new
// player's tutorial on a slow or absent connection.
let progressResolved = false
let progressHadExisting = false
const progressResolvedListeners = new Set()

function resolveProgress(hasExisting) {
  if (progressResolved) return
  progressResolved = true
  progressHadExisting = hasExisting
  for (const fn of progressResolvedListeners) {
    try {
      fn(hasExisting)
    } catch {
      // A broken subscriber must not wedge the netcode.
    }
  }
}

export function onProgressResolved(fn) {
  if (progressResolved) {
    fn(progressHadExisting)
    return () => {}
  }
  progressResolvedListeners.add(fn)
  return () => progressResolvedListeners.delete(fn)
}

// --- Avatar + position relay (remote-player rendering) ----------------------
// The same shape components/Player.jsx renders the LOCAL player from — the
// game's own default character (gender + outfit for the current Age level),
// dressed with a signed-in player's equipped Bloxity hat/back accessory and
// SDK proportions. Sent as an opaque JSON string (server never parses it —
// IslandRoom.ts's PlayerState.avatar, same convention as the original
// Ice-Skate payload), so components/RemotePlayers.jsx can rebuild an
// identical-looking character for every other connected session.
function avatarPayload() {
  const s = useGameStore.getState()
  return {
    gender: s.gender ?? 'boy',
    outfit: outfitForLevel(s.level),
    // Same gate as Player.jsx's useBloxityAvatar: only a real signed-in
    // player (never a dev-mode stub) shows Bloxity accessories.
    equipped: authState.user && !DEV_MODE ? getEquippedAvatar() : null,
    proportions: getProportions(),
    // Piggybacks the already-relayed avatar string to tell every other
    // client which Age Machine (if any) we're currently riding — the server
    // never parses this field, so no backend change is needed to add it.
    // isAgeMachineTakenByRemote() below reads it back out of remotePlayers'
    // live avatar field to keep a machine to one rider at a time. Best-effort
    // only (no server-side lock): two sessions clicking "Use" on the same
    // free machine in the same instant can still both win, no worse than any
    // other remote-player field here being a packet behind.
    ridingAgeMachine: s.ridingAgeMachine,
  }
}

let lastSentAvatar = ''

function sendAvatarNow() {
  if (!room) return
  const payload = JSON.stringify(avatarPayload())
  if (payload === lastSentAvatar) return
  lastSentAvatar = payload
  try {
    room.send('setAvatar', { avatar: payload })
  } catch {
    // Socket mid-close — the next attach re-seeds via join options anyway.
  }
}

// Last level/gender/ridingAgeMachine we already triggered a resend for —
// useGameStore.subscribe fires on every store change, same filtering need as
// lastScheduledStats. ridingAgeMachine is included so entering/exiting a
// machine propagates to isAgeMachineTakenByRemote() on every other client
// right away, not just whenever level/gender next happens to change.
let lastAvatarTrigger = { level: undefined, gender: undefined, ridingAgeMachine: undefined }

function onLocalStoreChangeAvatar(state) {
  if (
    state.level !== lastAvatarTrigger.level ||
    state.gender !== lastAvatarTrigger.gender ||
    state.ridingAgeMachine !== lastAvatarTrigger.ridingAgeMachine
  ) {
    lastAvatarTrigger = { level: state.level, gender: state.gender, ridingAgeMachine: state.ridingAgeMachine }
    sendAvatarNow()
  }
}

// Local player's position/facing/gait, throttled out over `move` — read
// straight off the playerState.js singleton every frame (components/
// GameLoop.jsx calls this after systems/playerMovement.js's step()), same
// "no per-frame packet" restraint as the debounced stats/progress sends
// above, just on a tighter ceiling since a walk needs to read as continuous
// on every other client. A no-op while offline.
let moveAccumMs = 0
let lastSentMove = null
const MOVE_EPS = 0.01

export function reportLocal(delta) {
  if (!room) return
  moveAccumMs += delta * 1000
  if (moveAccumMs < MOVE_SEND_INTERVAL_MS) return
  moveAccumMs = 0

  const speed01 = Math.min(1, Math.hypot(player.velocity.x, player.velocity.z) / player.moveSpeed)
  const next = { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.facing, moveBlend: speed01 }
  if (
    lastSentMove &&
    Math.abs(next.x - lastSentMove.x) < MOVE_EPS &&
    Math.abs(next.y - lastSentMove.y) < MOVE_EPS &&
    Math.abs(next.z - lastSentMove.z) < MOVE_EPS &&
    Math.abs(next.yaw - lastSentMove.yaw) < MOVE_EPS &&
    Math.abs(next.moveBlend - lastSentMove.moveBlend) < MOVE_EPS
  ) {
    return
  }
  lastSentMove = next
  try {
    room.send('move', next)
  } catch {
    // Socket mid-close — harmless, the next tick tries again.
  }
}

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
  // Signing in/out flips avatarPayload()'s equipped gate (only a real
  // signed-in player shows Bloxity accessories) — resend so every other
  // client's rendering of us picks that up immediately rather than on
  // whatever's next scheduled.
  sendAvatarNow()
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
        // Seeds IslandRoom.ts's onJoin -> PlayerState.avatar, so any client
        // already in the room renders us correctly from the very first frame
        // instead of a flash of the default outfit until our first
        // `setAvatar` round-trips.
        avatar: JSON.stringify(avatarPayload()),
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
    resolveProgress(true)
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

  // Raw MapSchema has no .onAdd/.onRemove of its own (those only exist on
  // the callback-proxy view) — this room's own live PlayerState objects are
  // still read directly off room.state.players.get(sessionId) every frame
  // (position/avatar fields patch in place), $() is only needed for the
  // join/leave *events* below.
  //
  // room.state can still be an empty shell for a moment right after
  // joinOrCreate() resolves — the full state patch (players included) lands
  // slightly later over the socket, not synchronously with the join.
  // getStateCallbacks()'s proxy handles that itself (it defers registration
  // until the `players` map instance actually arrives), but only if it's
  // called unconditionally here — an `if (room.state.players)` guard around
  // this would skip registering the callback entirely during that window,
  // and it would then never fire for anyone for the rest of the session.
  const $ = sdkModule.getStateCallbacks(room)
  $(room.state).players.onAdd((p, sessionId) => {
    recount()
    if (sessionId === selfId) return
    remotePlayers.set(sessionId, p)
    notifyRosterAdd(sessionId, p)
  })
  $(room.state).players.onRemove((p, sessionId) => {
    recount()
    if (sessionId === selfId) return
    remotePlayers.delete(sessionId)
    notifyRosterRemove(sessionId)
  })

  // Same reasoning as scheduleStatsResend: a fresh session starts every
  // field at its schema default (0), so a rejoin needs its current
  // speed/coins/rebirth re-stated immediately rather than waiting for the
  // next store change.
  sendStatsNow()
  // Ditto for avatar — force a resend even if it's byte-identical to
  // whatever we last sent on a prior connection (a fresh room has none of
  // that; join options already carried the seed, but a slow join can still
  // race an early setAvatar before the room finishes handshaking).
  lastSentAvatar = ''
  sendAvatarNow()
  lastSentMove = null
  moveAccumMs = MOVE_SEND_INTERVAL_MS // send the very next reportLocal() tick
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
  // Every remote character mounted by components/RemotePlayers.jsx belongs
  // to a session on the room we just lost — drop them all rather than leave
  // stale bodies standing around until a fresh attach's onAdd events happen
  // to replace each one.
  for (const sessionId of remotePlayers.keys()) notifyRosterRemove(sessionId)
  remotePlayers.clear()

  if (stopped) return
  attempt = 0
  scheduleRetry()
}

// --- Public lifecycle -------------------------------------------------
let offStats = null
let offProgress = null
let offIdentity = null
let offAvatarStore = null
let offAvatarChanged = null
let offProportionsChanged = null

export function init() {
  if (started) return
  started = true
  stopped = false
  // Ceiling on the new-vs-returning signal above — fires unconditionally so
  // it also covers the `!SERVER_URL` early return right below (no backend at
  // all means no way to ever confirm existing progress).
  setTimeout(() => resolveProgress(false), PROGRESS_KNOWN_TIMEOUT_MS)
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
  // Whatever changes avatarPayload()'s output -> the room, so every other
  // client's rendering of us stays accurate: an Age-level outfit change or a
  // gender pick, an equip/unequip in the Bloxity customizer, or an edited
  // proportions slider.
  if (!offAvatarStore) offAvatarStore = useGameStore.subscribe(onLocalStoreChangeAvatar)
  if (!offAvatarChanged) offAvatarChanged = onAvatarChanged(() => sendAvatarNow())
  if (!offProportionsChanged) offProportionsChanged = onProportionsChanged(() => sendAvatarNow())
  waitForAuth(USERNAME_WAIT_MS).then(() => {
    // A confirmed guest never gets a `progress` message (loadProgress is only
    // ever called for a signed-in userId) — resolve now instead of riding out
    // the full PROGRESS_KNOWN_TIMEOUT_MS ceiling for the common case.
    if (!getStableUserId()) resolveProgress(false)
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
  if (offAvatarStore) {
    offAvatarStore()
    offAvatarStore = null
  }
  if (offAvatarChanged) {
    offAvatarChanged()
    offAvatarChanged = null
  }
  if (offProportionsChanged) {
    offProportionsChanged()
    offProportionsChanged = null
  }
  // Every remote character mounted by components/RemotePlayers.jsx belongs
  // to this room — same reasoning as handleLeave()'s own clear.
  for (const sessionId of remotePlayers.keys()) notifyRosterRemove(sessionId)
  remotePlayers.clear()
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
