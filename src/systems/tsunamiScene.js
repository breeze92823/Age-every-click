import { GROUND_Y, SPAWN as ISLAND_SPAWN, SPAWN_FACING as ISLAND_SPAWN_FACING } from '../data/world.js'
import {
  OUTER_RECT,
  PIT_RECT,
  SLABS,
  WALL_HEIGHT,
  REWARD_PAD,
  REWARD_COINS,
  WAVE,
  WAVE_TYPES,
} from '../data/tsunamiScene.js'
import { player, resetPlayer } from './playerState.js'
import { syncYawToPlayer } from './cameraOrbit.js'
import { useGameStore } from '../store/useGameStore.js'
import { playLevelUp, playActionFail } from './sfx.js'

// Fixed pool of wave slots, mutated in place so TsunamiScene.jsx can bind
// one mesh group per slot and read them every frame without a React
// subscription. `type` indexes WAVE_TYPES.
export const waves = Array.from({ length: WAVE.maxActive }, () => ({ active: false, z: WAVE.startZ, type: 0 }))
let spawnWait = WAVE.firstDelay

export function resetTsunami() {
  for (const w of waves) w.active = false
  spawnWait = WAVE.firstDelay
}

// A new wave of `speed` starting now must be minGap behind every active
// wave, and stay so until that wave finishes — a faster one only closes the
// gap, so checking the moment the one ahead reaches endZ is enough.
function fitsBehindAll(speed) {
  for (const w of waves) {
    if (!w.active) continue
    if (w.z - WAVE.startZ < WAVE.minGap) return false
    const ahead = WAVE_TYPES[w.type].speed
    if (speed > ahead) {
      const t = (WAVE.endZ - w.z) / ahead
      if (WAVE.endZ - (WAVE.startZ + speed * t) < WAVE.minGap) return false
    }
  }
  return true
}

function trySpawn() {
  const slot = waves.find((w) => !w.active)
  if (!slot) return false
  const options = WAVE_TYPES.map((_, i) => i).filter((i) => fitsBehindAll(WAVE_TYPES[i].speed))
  if (!options.length) return false
  slot.type = options[Math.floor(Math.random() * options.length)]
  slot.z = WAVE.startZ
  slot.active = true
  return true
}

function stepWaves(dt) {
  for (const w of waves) {
    if (!w.active) continue
    w.z += WAVE_TYPES[w.type].speed * dt
    if (w.z >= WAVE.endZ) w.active = false
  }
  spawnWait -= dt
  if (spawnWait <= 0 && trySpawn()) {
    const [min, max] = WAVE.delay
    spawnWait = min + Math.random() * (max - min)
  }
}

// Feet above this count as exposed: standing on a slab, or jumping out of a gap.
const EXPOSED_Y = WAVE.bottom - 0.5

function hitByWave(p) {
  if (p.y <= EXPOSED_Y) return false
  return waves.some((w) => w.active && p.z <= w.z + 0.6 && p.z >= w.z - WAVE.depth)
}

// Runtime for the Tsunami Escape trench: the rim walls and the raised safe
// slabs are solid blocks, so anything taller than a small step-up blocks
// walking — the slabs have to be jumped onto, the walls can't be climbed.

const STEP_UP = 0.15
// Feet count as supported slightly inside the capsule radius, so standing
// at a slab's base never reads the taller block as ground.
const FOOT_FRACTION = 0.6

function inRect([x0, z0, x1, z1], x, z) {
  return x >= x0 && x <= x1 && z >= z0 && z <= z1
}

function topAt(x, z) {
  if (!inRect(OUTER_RECT, x, z)) return -Infinity
  if (!inRect(PIT_RECT, x, z)) return GROUND_Y + WALL_HEIGHT
  for (const s of SLABS) if (inRect(s.rect, x, z)) return s.top
  return GROUND_Y
}

function maxTopAround(x, z, r) {
  return Math.max(topAt(x, z), topAt(x + r, z), topAt(x - r, z), topAt(x, z + r), topAt(x, z - r))
}

export function tsunamiGroundAt(x, z, radius) {
  return maxTopAround(x, z, radius * FOOT_FRACTION)
}

// Undoes this frame's horizontal move along whichever axis ran into a wall
// or slab face, so the player slides along it instead of sticking.
export function resolveTsunamiWalls(prevX, prevZ, p, radius) {
  const limit = p.y + STEP_UP
  if (maxTopAround(p.x, p.z, radius) <= limit) return
  if (maxTopAround(p.x, prevZ, radius) <= limit) p.z = prevZ
  else if (maxTopAround(prevX, p.z, radius) <= limit) p.x = prevX
  else {
    p.x = prevX
    p.z = prevZ
  }
}

// Runs after playerMovement.js has landed the player this frame. Returns
// true when it teleported the player, so the caller stops there.
export function stepTsunami(dt) {
  stepWaves(dt)
  const p = player.position
  if (hitByWave(p)) {
    playActionFail()
    useGameStore.getState().setScene('island')
    resetPlayer(ISLAND_SPAWN, ISLAND_SPAWN_FACING)
    syncYawToPlayer()
    return true
  }
  const half = REWARD_PAD.size / 2
  if (player.grounded && Math.abs(p.x - REWARD_PAD.x) <= half && Math.abs(p.z - REWARD_PAD.z) <= half) {
    useGameStore.getState().awardCoins(REWARD_COINS)
    playLevelUp()
    useGameStore.getState().setScene('island')
    resetPlayer(ISLAND_SPAWN, ISLAND_SPAWN_FACING)
    syncYawToPlayer()
    return true
  }
  return false
}
