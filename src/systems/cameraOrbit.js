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

const target = { x: 0, y: 0, z: 0 }
const lookAt = { x: 0, y: 0, z: 0 }
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
}
