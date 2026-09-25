import { inputState } from './input.js'
import { player } from './playerState.js'

// Third-person follow with right/middle-drag orbit + wheel zoom, plus a
// keyboard turn: A/D and the left/right arrows yaw the camera around the
// player at a constant rate, so W/S become "walk the way the camera's
// facing" rather than a fixed world-relative direction. Trimmed from
// Ice-Skate's version by dropping its wall-collision clamp — this
// template's ground is one flat open plane, nothing to clip the camera
// into.
const START_PITCH = 0.35 // radians above the horizon
const state = {
  yaw: 0, // radians; 0 puts the camera on +Z looking toward -Z
  pitch: START_PITCH,
  distance: 7,
}

const MIN_PITCH = -0.15
const MAX_PITCH = 1.3
const MIN_DIST = 3
const MAX_DIST = 50
const ORBIT_SENS = 0.005
const ZOOM_SENS = 0.01
const TURN_KEY_RATE = 2.4 // rad/s, A/D or arrow keys held

// Position and look-at ease at different rates, so the rig reads as a
// third-person follow cam rather than a rigid mount.
const POSITION_SMOOTHING = 12
const LOOK_SMOOTHING = 20

// A same-frame jump in the player's position bigger than this is a teleport
// (a fresh spawn) rather than real movement — snap instead of swooping.
const TELEPORT_DISTANCE = 15

// Motion feel, layered on top of the follow cam as a small offset/roll that
// never feeds back into the smoothed rig position.
const BOB_FREQ = 2.1 // footfalls' worth of bob cycles per second at full speed
const BOB_VERTICAL = 0.04 // m, up/down bounce (twice per bob cycle)
const BOB_LATERAL = 0.022 // m, side-to-side sway (once per bob cycle)
const BOB_ROLL = 0.004 // rad, slight roll that follows the sway
const STRAFE_ROLL = 0.03 // rad, max lean into a sideways move
const STRAFE_SMOOTHING = 8
const IDLE_SWAY_X = 0.018 // m
const IDLE_SWAY_Y = 0.024 // m, breathing
const IDLE_SWAY_ROLL = 0.004 // rad
const AMP_SMOOTHING = 8 // how fast bob/idle fade in and out

const target = { x: 0, y: 0, z: 0 }
const lookAt = { x: 0, y: 0, z: 0 }
const bobOffset = { x: 0, y: 0, z: 0 } // applied to camera.position last frame
let bobPhase = 0
let idleTime = 0
let walkAmp = 0
let strafeRoll = 0

// Jump/landing kick: a damped spring on the camera's vertical offset that
// takeoff and touchdown push on. Slightly underdamped so it settles with one
// small rebound.
const KICK_STIFFNESS = 120
const KICK_DAMPING = 14
const JUMP_DIP = 0.3 // m/s of downward push at takeoff
const LAND_DIP_PER_SPEED = 0.09 // m/s of push per m/s of fall speed
const LAND_MIN_SPEED = 2.5 // m/s, softer touchdowns (small drops) are ignored
const LAND_MAX_SPEED = 14 // m/s, caps the dip on long falls
let kickY = 0
let kickV = 0
let wasGrounded = true
let airFallSpeed = 0 // fastest downward speed this airtime; velocity.y is zeroed on touchdown
const lastTarget = { x: 0, y: 0, z: 0 }
let initialised = false
let sensitivity = 1

// Driven by the portal's camera_sensitivity setting (systems/bloxity.js).
export function setSensitivity(mult) {
  sensitivity = Number.isFinite(mult) && mult > 0 ? mult : 1
}

export function getYaw() {
  return state.yaw
}

// Snaps the orbit to sit directly behind the player, e.g. right after spawn.
export function syncYawToPlayer() {
  state.yaw = player.facing + Math.PI
}

export function update(camera, dt) {
  state.yaw -= inputState.look.dx * ORBIT_SENS * sensitivity
  state.pitch += inputState.look.dy * ORBIT_SENS * sensitivity
  inputState.look.dx = 0
  inputState.look.dy = 0

  state.yaw -= inputState.turn * TURN_KEY_RATE * sensitivity * dt

  if (state.pitch < MIN_PITCH) state.pitch = MIN_PITCH
  if (state.pitch > MAX_PITCH) state.pitch = MAX_PITCH

  state.distance += inputState.zoom * ZOOM_SENS * sensitivity
  inputState.zoom = 0
  if (state.distance < MIN_DIST) state.distance = MIN_DIST
  if (state.distance > MAX_DIST) state.distance = MAX_DIST

  target.x = player.position.x
  target.y = player.position.y + player.dims.height * 0.6
  target.z = player.position.z

  const jump = Math.hypot(target.x - lastTarget.x, target.y - lastTarget.y, target.z - lastTarget.z)
  const teleported = initialised && jump > TELEPORT_DISTANCE
  lastTarget.x = target.x
  lastTarget.y = target.y
  lastTarget.z = target.z

  if (teleported) {
    state.yaw = player.facing + Math.PI
    state.pitch = START_PITCH
  }

  const cp = Math.cos(state.pitch)
  const dirX = Math.sin(state.yaw) * cp
  const dirY = Math.sin(state.pitch)
  const dirZ = Math.cos(state.yaw) * cp

  const desiredX = target.x + dirX * state.distance
  const desiredY = target.y + dirY * state.distance
  const desiredZ = target.z + dirZ * state.distance

  // Strip last frame's bob so the smoothing below runs on the clean rig.
  camera.position.x -= bobOffset.x
  camera.position.y -= bobOffset.y
  camera.position.z -= bobOffset.z

  if (!initialised || teleported) {
    camera.position.set(desiredX, desiredY, desiredZ)
    lookAt.x = target.x
    lookAt.y = target.y
    lookAt.z = target.z
    initialised = true
  } else {
    const tPos = dt > 0 ? 1 - Math.exp(-POSITION_SMOOTHING * dt) : 1
    camera.position.x += (desiredX - camera.position.x) * tPos
    camera.position.y += (desiredY - camera.position.y) * tPos
    camera.position.z += (desiredZ - camera.position.z) * tPos

    const tLook = dt > 0 ? 1 - Math.exp(-LOOK_SMOOTHING * dt) : 1
    lookAt.x += (target.x - lookAt.x) * tLook
    lookAt.y += (target.y - lookAt.y) * tLook
    lookAt.z += (target.z - lookAt.z) * tLook
  }

  camera.lookAt(lookAt.x, lookAt.y, lookAt.z)
  applyMotionFeel(camera, dt, teleported)
}

// Head/view bob while walking, lean into sideways movement, and a slow
// breathing sway when standing still. Runs after lookAt so the roll composes
// with the final orientation.
function applyMotionFeel(camera, dt, teleported) {
  const vx = player.velocity.x
  const vz = player.velocity.z
  const speed01 = Math.min(1, Math.hypot(vx, vz) / (player.moveSpeed || 1))
  const walking = player.grounded ? speed01 : 0

  // Sideways speed relative to where the camera is looking.
  const rightX = Math.cos(state.yaw)
  const rightZ = -Math.sin(state.yaw)
  const strafe01 = Math.max(-1, Math.min(1, (vx * rightX + vz * rightZ) / (player.moveSpeed || 1)))

  if (teleported) {
    walkAmp = 0
    strafeRoll = 0
    kickY = 0
    kickV = 0
    airFallSpeed = 0
    wasGrounded = player.grounded
  }

  if (wasGrounded && !player.grounded && player.velocity.y > 0) {
    kickV -= JUMP_DIP
  } else if (!wasGrounded && player.grounded && airFallSpeed > LAND_MIN_SPEED) {
    kickV -= Math.min(airFallSpeed, LAND_MAX_SPEED) * LAND_DIP_PER_SPEED
  }
  wasGrounded = player.grounded
  airFallSpeed = player.grounded ? 0 : Math.max(airFallSpeed, -player.velocity.y)

  // Substep so a long frame can't blow up the spring.
  let remaining = Math.min(dt, 0.1)
  while (remaining > 0) {
    const h = Math.min(remaining, 1 / 120)
    kickV += (-KICK_STIFFNESS * kickY - KICK_DAMPING * kickV) * h
    kickY += kickV * h
    remaining -= h
  }

  const k = dt > 0 ? 1 - Math.exp(-AMP_SMOOTHING * dt) : 1
  walkAmp += (walking - walkAmp) * k
  const kStrafe = dt > 0 ? 1 - Math.exp(-STRAFE_SMOOTHING * dt) : 1
  strafeRoll += (strafe01 * STRAFE_ROLL - strafeRoll) * kStrafe

  bobPhase += dt * BOB_FREQ * Math.PI * 2 * speed01
  idleTime += dt

  const idle = 1 - walkAmp
  const bobSin = Math.sin(bobPhase)
  const bobY = Math.abs(Math.cos(bobPhase)) * 2 - 1 // -1..1, two dips per cycle

  const offY = bobY * BOB_VERTICAL * walkAmp + Math.sin(idleTime * 1.3) * IDLE_SWAY_Y * idle + kickY
  const offSide = bobSin * BOB_LATERAL * walkAmp + Math.sin(idleTime * 0.7) * IDLE_SWAY_X * idle

  // Lateral offset goes along the camera's own right vector.
  bobOffset.x = rightX * offSide
  bobOffset.y = offY
  bobOffset.z = rightZ * offSide
  camera.position.x += bobOffset.x
  camera.position.y += bobOffset.y
  camera.position.z += bobOffset.z

  const roll = bobSin * BOB_ROLL * walkAmp + Math.sin(idleTime * 0.9) * IDLE_SWAY_ROLL * idle - strafeRoll
  camera.rotateZ(roll)
}
