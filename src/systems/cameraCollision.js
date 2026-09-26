import { useGameStore } from '../store/useGameStore.js'
import { WATER_Y, ISLAND_SCALE } from '../data/world.js'
import { terrainHeightAt, AGE_MACHINES_TOP_Y } from './terrainHeight.js'
import { resolveAgeMachineCollision } from './ageMachineCollision.js'
import { resolveLandmarkCollision } from './landmarkCollision.js'
import { bonusGroundAt } from './bonusBridge.js'
import { studJumpsGroundAt } from './studJumps.js'
import { tsunamiGroundAt } from './tsunamiScene.js'

// Keeps the third-person camera out of the floor and out of solid scenery.
// The rig itself is unchanged; cameraOrbit.js asks for a shorter boom
// (safeDistance) and then a last push-out (resolvePosition) on the smoothed
// position, since easing between two safe points can still clip a corner.

const FLOOR_MARGIN = 0.35 // m the camera stays above the surface under it
const BODY_RADIUS = 0.4 // m clearance kept from solid objects
const STEP = 0.25 // m between samples along the boom
const MIN_DISTANCE = 0.6 // never pull closer than this to the look target
// Approximate height of a machine above its stand; a camera higher than this
// is flying over it rather than inside it.
const MACHINE_HEIGHT = 3 * ISLAND_SCALE
const PLAYER_CAM_RADIUS = 0.4 // dims.radius stand-in for the scenes' ground lookups

// Surface under (x, z) that the camera must stay above. Void gaps (-Infinity)
// fall back to the water plane so the camera can't dive under the sea.
function floorAt(x, z) {
  const scene = useGameStore.getState().currentScene
  let g
  if (scene === 'island') g = terrainHeightAt(x, z)
  else if (scene === 'bonus') g = bonusGroundAt(x, z)
  else if (scene === 'studJumps') g = studJumpsGroundAt(x, z, PLAYER_CAM_RADIUS)
  else g = tsunamiGroundAt(x, z, PLAYER_CAM_RADIUS)
  if (!Number.isFinite(g)) return WATER_Y + FLOOR_MARGIN
  return g + FLOOR_MARGIN
}

// Pushes (x, z) out of solid scenery for a camera at height y. While riding
// an Age Machine the player stands inside its pedestal, so it's ignored then.
function pushOut(x, y, z) {
  let p = { x, z }
  const { currentScene, ridingAgeMachine } = useGameStore.getState()
  if (currentScene !== 'island') return p
  if (ridingAgeMachine == null && y < AGE_MACHINES_TOP_Y + MACHINE_HEIGHT) {
    p = resolveAgeMachineCollision(p.x, p.z, BODY_RADIUS)
  }
  return resolveLandmarkCollision(p.x, p.z, BODY_RADIUS, y)
}

function blockedAt(x, y, z) {
  if (y < floorAt(x, z)) return true
  const p = pushOut(x, y, z)
  return p.x !== x || p.z !== z
}

// Largest boom length <= wanted along target -> (dir * wanted) with no
// sample inside the ground or an obstacle.
export function safeDistance(tx, ty, tz, dirX, dirY, dirZ, wanted) {
  let last = Math.min(MIN_DISTANCE, wanted)
  for (let d = STEP; d <= wanted + 1e-6; d += STEP) {
    const dist = Math.min(d, wanted)
    if (blockedAt(tx + dirX * dist, ty + dirY * dist, tz + dirZ * dist)) return Math.max(last, MIN_DISTANCE)
    last = dist
  }
  return wanted
}

// Final clamp on a camera position: lift out of the floor, push out of
// obstacles sideways. Mutates and returns pos.
export function resolvePosition(pos) {
  const floor = floorAt(pos.x, pos.z)
  if (pos.y < floor) pos.y = floor
  const p = pushOut(pos.x, pos.y, pos.z)
  pos.x = p.x
  pos.z = p.z
  return pos
}
