import { create } from 'zustand'
import { GROUND_Y, SPAWN as ISLAND_SPAWN, SPAWN_FACING as ISLAND_SPAWN_FACING } from '../data/world.js'
import {
  START_RECT,
  END_RECT,
  SPAWN_RECT,
  EXIT_PAD,
  FINISH_PAD,
  TILE_SIZE,
  LANE_X,
  COLUMN_PITCH,
  FIRST_COLUMN_Z,
  COLUMNS,
  SPAWN,
  SPAWN_FACING,
  TIME_LIMIT,
  REWARD_COINS,
  FALL_RESET_Y,
  SAFE_BOUNCE_DURATION,
  UNSAFE_RESET_DELAY,
} from '../data/bonusBridge.js'
import { player, resetPlayer } from './playerState.js'
import { syncYawToPlayer } from './cameraOrbit.js'
import { useGameStore } from '../store/useGameStore.js'
import { playWallBreak, playActionFail, playLevelUp } from './sfx.js'
import { getBridgeTiles, sendBridgeStep, sendBridgeFail } from './net.js'

// Runtime state for the Bonus Scene's glass bridge. Tiles are mutated in
// place (never reallocated) so BonusScene.jsx can bind one mesh per entry
// and read them every frame without a React subscription.
//
// `safe`/`broken`/`bounced` are mirrored every frame off the shared room's
// BridgeTileState array (server rooms/IslandRoom.ts, via net.js's
// getBridgeTiles()) whenever connected — see syncFromNetwork() below — so
// every player online at once sees and affects the exact same puzzle. A
// single fall/timeout only resets the failing player's own run (see
// respawnAtStart()), but the room counts failures across the whole group
// and rerolls the shared layout after BRIDGE_RESHUFFLE_AFTER_FAILS of them
// (IslandRoom.ts's `bridgeFail` handler) — reaching every client, including
// anyone still mid-attempt, the same way a remote footstep does.
// Offline/solo (no room), this file falls back to owning those three fields
// itself exactly as before multiplayer support existed: resetBonusBridge()
// randomizes `safe` locally per attempt, and stepBonusBridge() mutates
// `broken`/`bounced` straight off the local player's own footsteps.

// How far past an edge the player's feet still count as supported. Tiles
// get exactly half the 0.4 m row gap, so rows join up but the 0.5 m slot
// between the two lanes stays open — no walking the centre line to dodge
// the breaking tiles.
const PLATFORM_MARGIN = 0.35
const TILE_MARGIN = 0.2

// kind: 'glass' (magenta, random), 'arrow' (fixed safe), 'cross' (fixed fake)
export const tiles = []
for (let c = 0; c < COLUMNS; c++) {
  for (let lane = 0; lane < LANE_X.length; lane++) {
    const last = c === COLUMNS - 1
    tiles.push({
      index: tiles.length, // matches server BridgeTileState array index 1:1 — see syncFromNetwork()
      x: LANE_X[lane],
      z: FIRST_COLUMN_Z - c * COLUMN_PITCH,
      column: c,
      lane,
      kind: last ? (lane === 0 ? 'arrow' : 'cross') : 'glass',
      safe: last && lane === 0,
      bounced: false, // one-shot guard: the safe hop only plays once per attempt
      bounceT: null, // seconds into the safe hop tween, or null when idle
      broken: false, // collision (see supports()) disabled while sprung
      trapT: null, // seconds into the unsafe shrink/reset tween, or null when idle/re-armed
    })
  }
}

// Only whole seconds reach React, so the HUD re-renders once a second.
export const useBonusTimer = create(() => ({ timeLeft: TIME_LIMIT }))

let running = false
let remaining = TIME_LIMIT

// Mirrors the shared room's tile state onto the local `tiles` array, one
// field at a time, and edge-detects the transitions that need a fresh local
// animation clock — bounceT/trapT are purely cosmetic tweens, so every
// client just runs its own, they don't need to be frame-perfect synced.
// Returns false when there's nothing to mirror (no room, or the synced
// array hasn't arrived yet), so callers fall back to local-authority mode.
function syncFromNetwork() {
  const net = getBridgeTiles()
  if (!net || net.length < tiles.length) return false
  for (let i = 0; i < tiles.length; i++) {
    const nt = net[i]
    const t = tiles[i]
    t.safe = nt.safe
    if (nt.bounced && !t.bounced) {
      t.bounced = true
      t.bounceT = 0
    }
    if (nt.broken && !t.broken) {
      t.broken = true
      t.trapT = 0
      playWallBreak()
    } else if (!nt.broken && t.broken) {
      t.broken = false
    }
  }
  return true
}

export function resetBonusBridge() {
  // Online, the layout and every tile's live state belong to the shared
  // room (server rooms/IslandRoom.ts) — this one player's own fall/timeout
  // must never by itself wipe the safe-tile progress the rest of the group
  // already found (a reshuffle only fires once enough failures pile up
  // across everyone — see respawnAtStart()'s sendBridgeFail() and
  // BRIDGE_RESHUFFLE_AFTER_FAILS' own comment). Only this player's own run
  // (the countdown below) is personal.
  if (!getBridgeTiles()) {
    for (let c = 0; c < COLUMNS - 1; c++) {
      const safeLane = Math.random() < 0.5 ? 0 : 1
      for (const t of tiles) if (t.column === c) t.safe = t.lane === safeLane
    }
    for (const t of tiles) {
      t.bounced = false
      t.bounceT = null
      t.broken = false
      t.trapT = null
    }
  }
  running = false
  remaining = TIME_LIMIT
  useBonusTimer.setState({ timeLeft: TIME_LIMIT })
}

function inRect([x0, z0, x1, z1], x, z, margin) {
  return x >= x0 - margin && x <= x1 + margin && z >= z0 - margin && z <= z1 + margin
}

function supports(t, x, z) {
  const half = TILE_SIZE / 2 + TILE_MARGIN
  return !t.broken && Math.abs(x - t.x) <= half && Math.abs(z - t.z) <= half
}

// EXIT_PAD (yellow, spawn platform) pays out and returns to island in one
// step. FINISH_PAD (yellow, finish platform) just returns to island, no
// payout — see the two checks in stepBonusBridge below.
function onExitPad(x, z) {
  const half = EXIT_PAD.size / 2
  return Math.abs(x - EXIT_PAD.x) <= half && Math.abs(z - EXIT_PAD.z) <= half
}

function onFinishPad(x, z) {
  const half = FINISH_PAD.size / 2
  return Math.abs(x - FINISH_PAD.x) <= half && Math.abs(z - FINISH_PAD.z) <= half
}

// Top surface height under (x, z), or -Infinity over the void.
export function bonusGroundAt(x, z) {
  if (inRect(START_RECT, x, z, PLATFORM_MARGIN) || inRect(END_RECT, x, z, PLATFORM_MARGIN)) return GROUND_Y
  for (const t of tiles) if (supports(t, x, z)) return GROUND_Y
  return -Infinity
}

function respawnAtStart() {
  playActionFail()
  // Online, this also counts toward the shared room's reshuffle threshold
  // (server rooms/IslandRoom.ts's `bridgeFail` — see BRIDGE_RESHUFFLE_AFTER_
  // FAILS' own comment) — a no-op offline/solo, same guard as sendBridgeStep.
  sendBridgeFail()
  resetBonusBridge()
  resetPlayer(SPAWN, SPAWN_FACING)
  syncYawToPlayer()
}

// Runs after playerMovement.js has landed the player this frame. Returns
// true when it teleported the player, so the caller stops there.
export function stepBonusBridge(dt) {
  // Online, this also pulls the shared room's latest tile state onto the
  // local `tiles` array (see syncFromNetwork()'s own comment) before
  // anything below reads safe/broken this frame.
  const online = syncFromNetwork()

  // Advance each tile's own tween clock. A safe hop always finishes and
  // clears (bounceT -> null). An unsafe trap's shrink/flash clears the same
  // way; offline it also re-arms itself right here (broken -> false), but
  // online the room's own re-arm timer is what actually restores collision
  // — syncFromNetwork() above picks that up as a broken:true -> false edge,
  // so this must not race ahead of the server and clear it early.
  for (const t of tiles) {
    if (t.bounceT != null) {
      t.bounceT += dt
      if (t.bounceT >= SAFE_BOUNCE_DURATION) t.bounceT = null
    }
    if (t.trapT != null) {
      t.trapT += dt
      if (t.trapT >= UNSAFE_RESET_DELAY) {
        t.trapT = null
        if (!online) t.broken = false
      }
    }
  }

  const p = player.position

  if (player.grounded) {
    for (const t of tiles) {
      if (!supports(t, p.x, p.z)) continue
      if (online) {
        // The room alone decides the outcome (BridgeTileState.safe) — this
        // only reports the footstep. The resulting patch lands back on this
        // same tile next frame via syncFromNetwork() above and drives the
        // bounce/trap visuals uniformly, exactly like a remote player's own
        // footstep would.
        if ((t.safe && !t.bounced) || (!t.safe && !t.broken)) sendBridgeStep(t.index)
      } else if (t.safe) {
        // One-shot: don't restart the hop every frame the player just
        // stands there, or keep re-triggering it on repeat visits.
        if (!t.bounced) {
          t.bounced = true
          t.bounceT = 0
        }
      } else if (!t.broken) {
        t.broken = true
        t.trapT = 0
        playWallBreak()
      }
    }
  }

  if (player.grounded && onExitPad(p.x, p.z)) {
    useGameStore.getState().awardCoins(REWARD_COINS)
    playLevelUp()
    running = false
    useGameStore.getState().setScene('island')
    resetPlayer(ISLAND_SPAWN, ISLAND_SPAWN_FACING)
    syncYawToPlayer()
    return true
  }

  if (player.grounded && onFinishPad(p.x, p.z)) {
    running = false
    useGameStore.getState().setScene('island')
    resetPlayer(ISLAND_SPAWN, ISLAND_SPAWN_FACING)
    syncYawToPlayer()
    return true
  }

  if (!running && !inRect(SPAWN_RECT, p.x, p.z, 0)) running = true
  if (running) {
    remaining = Math.max(0, remaining - dt)
    const whole = Math.ceil(remaining)
    if (whole !== useBonusTimer.getState().timeLeft) useBonusTimer.setState({ timeLeft: whole })
  }

  if (p.y < FALL_RESET_Y || (running && remaining <= 0)) {
    respawnAtStart()
    return true
  }
  return false
}
