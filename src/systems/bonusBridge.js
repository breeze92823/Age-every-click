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
} from '../data/bonusBridge.js'
import { player, resetPlayer } from './playerState.js'
import { syncYawToPlayer } from './cameraOrbit.js'
import { useGameStore } from '../store/useGameStore.js'
import { playWallBreak, playActionFail, playLevelUp } from './sfx.js'

// Runtime state for the Bonus Scene's glass bridge. Tiles are mutated in
// place (never reallocated) so BonusScene.jsx can bind one mesh per entry
// and read them every frame without a React subscription.

// How far past an edge the player's feet still count as supported. Tiles
// get exactly half the 0.4 m row gap, so rows join up but the 0.5 m slot
// between the two lanes stays open — no walking the centre line to dodge
// the breaking tiles.
const PLATFORM_MARGIN = 0.35
const TILE_MARGIN = 0.2
const TILE_FALL_GRAVITY = 22
const TILE_GONE_DEPTH = 30

// kind: 'glass' (magenta, random), 'arrow' (fixed safe), 'cross' (fixed fake)
export const tiles = []
for (let c = 0; c < COLUMNS; c++) {
  for (let lane = 0; lane < LANE_X.length; lane++) {
    const last = c === COLUMNS - 1
    tiles.push({
      x: LANE_X[lane],
      z: FIRST_COLUMN_Z - c * COLUMN_PITCH,
      column: c,
      lane,
      kind: last ? (lane === 0 ? 'arrow' : 'cross') : 'glass',
      safe: last && lane === 0,
      revealed: false,
      broken: false,
      fall: 0,
      fallVel: 0,
    })
  }
}

// Only whole seconds reach React, so the HUD re-renders once a second.
export const useBonusTimer = create(() => ({ timeLeft: TIME_LIMIT }))

let running = false
let remaining = TIME_LIMIT

export function resetBonusBridge() {
  for (let c = 0; c < COLUMNS - 1; c++) {
    const safeLane = Math.random() < 0.5 ? 0 : 1
    for (const t of tiles) if (t.column === c) t.safe = t.lane === safeLane
  }
  for (const t of tiles) {
    t.revealed = false
    t.broken = false
    t.fall = 0
    t.fallVel = 0
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
  resetBonusBridge()
  resetPlayer(SPAWN, SPAWN_FACING)
  syncYawToPlayer()
}

// Runs after playerMovement.js has landed the player this frame. Returns
// true when it teleported the player, so the caller stops there.
export function stepBonusBridge(dt) {
  for (const t of tiles) {
    if (!t.broken || t.fall >= TILE_GONE_DEPTH) continue
    t.fallVel += TILE_FALL_GRAVITY * dt
    t.fall += t.fallVel * dt
  }

  const p = player.position

  if (player.grounded) {
    for (const t of tiles) {
      if (!supports(t, p.x, p.z)) continue
      if (t.safe) t.revealed = true
      else {
        t.broken = true
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
