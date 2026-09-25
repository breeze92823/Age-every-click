import { inputState } from './input.js'
import { player } from './playerState.js'
import { getYaw } from './cameraOrbit.js'
import { GROUND_Y } from '../data/world.js'
import { PLAYER_MOVE_SPEED } from '../data/progression.js'

// Kinematic capsule, stepped once per frame: apply input -> gravity ->
// integrate -> clamp to the ground plane. No collider list beyond the flat
// ground — this template has nothing else to collide with.

const ACCEL = 45 // m/s^2 approach toward target velocity
const GRAVITY = -22 // m/s^2
const JUMP_SPEED = 7.5 // m/s

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
    if (player.grounded) player.velocity.y = JUMP_SPEED
    inputState.jump = false
  }
  player.grounded = false

  player.velocity.y += GRAVITY * dt
  p.x += player.velocity.x * dt
  p.y += player.velocity.y * dt
  p.z += player.velocity.z * dt

  if (p.y <= GROUND_Y) {
    p.y = GROUND_Y
    if (player.velocity.y < 0) player.velocity.y = 0
    player.grounded = true
  }

  // Face the direction of travel.
  if (Math.hypot(wishX, wishZ) > 0.01) {
    player.facing = Math.atan2(wishX, wishZ)
  }
}
