import { inputState } from './input.js'
import { player, resetPlayer } from './playerState.js'
import { getYaw } from './cameraOrbit.js'
import { PLAYER_MOVE_SPEED } from '../data/progression.js'
import { terrainHeightAt } from './terrainHeight.js'
import { conveyorPushAt } from './conveyor.js'
import { resolveAgeMachineCollision } from './ageMachineCollision.js'
import { resolveLandmarkCollision } from './landmarkCollision.js'
import { checkScenePortal } from './scenePortals.js'
import { bonusGroundAt, stepBonusBridge, resetBonusBridge } from './bonusBridge.js'
import { studJumpsGroundAt, resolveStudJumpsWalls, stepStudJumps } from './studJumps.js'
import { tsunamiGroundAt, resolveTsunamiWalls, stepTsunami, resetTsunami } from './tsunamiScene.js'
import { syncYawToPlayer } from './cameraOrbit.js'
import { useGameStore } from '../store/useGameStore.js'

// Kinematic capsule, stepped once per frame: apply input -> gravity ->
// integrate -> clamp to the ground height under the player's feet. Ground
// height is a lookup rather than a flat plane, so low steps (the enclosure
// curbs) are climbed automatically instead of being clipped through.

const ACCEL = 45 // m/s^2 approach toward target velocity
const GRAVITY = -22 // m/s^2
const JUMP_SPEED = 7.5 // m/s
// Tsunami Escape's safe slabs are 1.5 m tall, above the normal ~1.28 m apex
// (JUMP_SPEED^2 / -2*GRAVITY), so that scene alone gets a taller jump.
const TSUNAMI_JUMP_SPEED = 8.4 // m/s, ~1.6 m apex
const STEP_TOLERANCE = 0.6 // m below a surface's top that still lands on it

// Clamps the (dx, dz) delta as one 2D vector rather than clamping each axis
// independently — an axis-by-axis clamp doesn't produce a delta that points
// at the target when the two axes need very different-sized corrections
// (e.g. right after a turn), so velocity visibly curves toward the target
// instead of accelerating straight at it.
function approach2D(v, targetX, targetZ, maxDelta) {
  const dx = targetX - v.x
  const dz = targetZ - v.z
  const dist = Math.hypot(dx, dz)
  if (dist <= maxDelta || dist === 0) {
    v.x = targetX
    v.z = targetZ
  } else {
    const scale = maxDelta / dist
    v.x += dx * scale
    v.z += dz * scale
  }
}

export function step(dt) {
  if (dt <= 0) return

  // Which environment is mounted right now — the island's obstacles/terrain
  // steps only apply while standing in it; the Bonus Scene's glass bridge
  // has its own ground lookup in bonusBridge.js.
  const currentScene = useGameStore.getState().currentScene
  const onIsland = currentScene === 'island'
  const onBonus = currentScene === 'bonus'
  const onStudJumps = currentScene === 'studJumps'
  const onTsunami = currentScene === 'tsunami'

  // Camera-relative ground basis.
  const yaw = getYaw()
  const fwdX = -Math.sin(yaw)
  const fwdZ = -Math.cos(yaw)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)

  const mv = inputState.move
  const wishX = fwdX * mv.z + rightX * mv.x
  const wishZ = fwdZ * mv.z + rightZ * mv.x

  // Fixed ground speed for the whole game — independent of skate tier,
  // level, or rebirth. Written onto the player singleton so other consumers
  // (e.g. net code, if this template ever gains multiplayer) read the same
  // value.
  const moveSpeed = PLAYER_MOVE_SPEED
  player.moveSpeed = moveSpeed

  approach2D(player.velocity, wishX * moveSpeed, wishZ * moveSpeed, ACCEL * dt)

  const p = player.position

  // Jump reads last frame's grounded flag, then we clear it for this frame.
  if (inputState.jump) {
    if (player.grounded) player.velocity.y = onTsunami ? TSUNAMI_JUMP_SPEED : JUMP_SPEED
    inputState.jump = false
  }
  player.grounded = false

  const prevX = p.x
  const prevZ = p.z
  player.velocity.y += GRAVITY * dt
  p.x += player.velocity.x * dt
  p.y += player.velocity.y * dt
  p.z += player.velocity.z * dt

  if (onIsland) {
    const blocked = resolveAgeMachineCollision(p.x, p.z, player.dims.radius)
    const blocked2 = resolveLandmarkCollision(blocked.x, blocked.z, player.dims.radius)
    p.x = blocked2.x
    p.z = blocked2.z
  } else if (onStudJumps) {
    resolveStudJumpsWalls(prevX, prevZ, p, player.dims.radius)
  } else if (onTsunami) {
    resolveTsunamiWalls(prevX, prevZ, p, player.dims.radius)
  }

  // The Bonus and Stud Jumps scenes have real gaps: their ground is
  // -Infinity over the void, and a player already falling past a surface's
  // top can't snap back up onto it from below.
  const groundY = onIsland
    ? terrainHeightAt(p.x, p.z)
    : onBonus
      ? bonusGroundAt(p.x, p.z)
      : onStudJumps
        ? studJumpsGroundAt(p.x, p.z, player.dims.radius)
        : tsunamiGroundAt(p.x, p.z, player.dims.radius)
  const canLand = onIsland || p.y >= groundY - STEP_TOLERANCE
  if (p.y <= groundY && canLand) {
    p.y = groundY
    if (player.velocity.y < 0) player.velocity.y = 0
    player.grounded = true
  }

  // Standing on a curb ring carries the player along with its chevrons,
  // on top of whatever input velocity already moved them this frame.
  if (player.grounded && onIsland) {
    const push = conveyorPushAt(p.x, p.z)
    if (push) {
      p.x += push.x * dt
      p.z += push.z * dt
    }
  }

  // Face the direction of travel.
  if (Math.hypot(wishX, wishZ) > 0.01) {
    player.facing = Math.atan2(wishX, wishZ)
  }

  if (onBonus && stepBonusBridge(dt)) return
  if (onStudJumps && stepStudJumps()) return
  if (onTsunami && stepTsunami(dt)) return

  // Stepping onto the Impossible Bridge, Stud Jumps or Tsunami Escape pad
  // (or the exit pad in whichever scene that led to) swaps which environment
  // is mounted and re-spawns the player there — see scenePortals.js.
  const portal = checkScenePortal(p.x, p.z, currentScene)
  if (portal) {
    if (portal.scene === 'bonus') resetBonusBridge()
    if (portal.scene === 'tsunami') resetTsunami()
    useGameStore.getState().setScene(portal.scene)
    resetPlayer(portal.spawn)
    syncYawToPlayer()
  }
}
