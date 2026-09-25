import { GROUND_Y, SPAWN as ISLAND_SPAWN, SPAWN_FACING as ISLAND_SPAWN_FACING } from '../data/world.js'
import { START_RECT, STEPS, SPAWN, FALL_RESET_Y, FLAG_RADIUS } from '../data/studJumpsScene.js'
import { player, resetPlayer } from './playerState.js'
import { syncYawToPlayer } from './cameraOrbit.js'
import { useGameStore } from '../store/useGameStore.js'
import { playLevelUp, playActionFail } from './sfx.js'

// Runtime for the Stud Jumps staircase: every step is a solid block, so a
// step taller than the player's feet (plus a tiny step-up allowance) blocks
// walking and has to be jumped. Landing on a rewarded step (the 11-14 stud
// checkpoint flags) pays its coins and sends the player straight back to
// the island, same as reaching the Bonus Scene's finish platform.

const STEP_UP = 0.15
// Feet count as supported slightly inside the capsule radius, so standing
// at a wall's base never reads the taller block as ground.
const FOOT_FRACTION = 0.6

function inRect([x0, z0, x1, z1], x, z) {
  return x >= x0 && x <= x1 && z >= z0 && z <= z1
}

function stepAt(x, z) {
  for (const s of STEPS) if (inRect(s.rect, x, z)) return s
  return null
}

function topAt(x, z) {
  const s = stepAt(x, z)
  if (s) return s.top
  return inRect(START_RECT, x, z) ? GROUND_Y : -Infinity
}

function maxTopAround(x, z, r) {
  return Math.max(topAt(x, z), topAt(x + r, z), topAt(x - r, z), topAt(x, z + r), topAt(x, z - r))
}

export function studJumpsGroundAt(x, z, radius) {
  return maxTopAround(x, z, radius * FOOT_FRACTION)
}

// Undoes this frame's horizontal move along whichever axis ran into a step
// face, so the player slides along walls instead of sticking to them.
export function resolveStudJumpsWalls(prevX, prevZ, p, radius) {
  const limit = p.y + STEP_UP
  if (maxTopAround(p.x, p.z, radius) <= limit) return
  if (maxTopAround(p.x, prevZ, radius) <= limit) p.z = prevZ
  else if (maxTopAround(prevX, p.z, radius) <= limit) p.x = prevX
  else {
    p.x = prevX
    p.z = prevZ
  }
}

// The rewarded step's flag is what actually pays out, not the step's floor —
// this finds whichever flag pole (if any) the player's capsule is touching.
function flagAt(x, z, radius) {
  const reach = FLAG_RADIUS + radius
  for (const s of STEPS) {
    if (!s.flag) continue
    const dx = x - s.flag.x
    const dz = z - s.flag.z
    if (dx * dx + dz * dz <= reach * reach) return s
  }
  return null
}

// Runs after playerMovement.js has landed the player this frame. Returns
// true when it teleported the player, so the caller stops there.
export function stepStudJumps() {
  const p = player.position

  const flag = flagAt(p.x, p.z, player.dims.radius)
  if (flag) {
    useGameStore.getState().awardCoins(flag.reward)
    playLevelUp()
    useGameStore.getState().setScene('island')
    resetPlayer(ISLAND_SPAWN, ISLAND_SPAWN_FACING)
    syncYawToPlayer()
    return true
  }

  if (p.y < FALL_RESET_Y) {
    playActionFail()
    resetPlayer(SPAWN)
    syncYawToPlayer()
    return true
  }

  return false
}
