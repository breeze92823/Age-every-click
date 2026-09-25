import { showMenu } from './bloxity.js'

// inputState: a keyboard turn (-1 A/Left .. +1 D/Right, consumed by
// cameraOrbit to yaw the camera), a forward/back move flag (W/S, consumed
// camera-relative by playerMovement), a mouse-drag look delta + wheel zoom
// (also consumed by cameraOrbit), and an edge-triggered jump.
export const inputState = {
  // x = strafe (+ right), z = forward (+ forward); pre-normalised. Keyboard
  // only ever writes z — A/D turn the camera (see `turn` below) instead of
  // strafing; touch's virtual joystick is the only thing that writes x.
  move: { x: 0, z: 0 },
  turn: 0,
  look: { dx: 0, dy: 0 }, // pixels dragged this frame; consumed by cameraOrbit
  zoom: 0, // wheel delta this frame; consumed by cameraOrbit
  jump: false, // set on keydown, consumed by playerMovement
}

// Touch sessions have no keyboard: components/hud/TouchControls.jsx drives
// inputState through the setters below. `active` flips once — on the first
// real touch, or immediately when the primary pointer is coarse — and never
// flips back for the session.
export const touchState = { active: false }
const touchModeSubs = new Set()

export function subscribeTouchMode(cb) {
  touchModeSubs.add(cb)
  return () => touchModeSubs.delete(cb)
}

function enableTouchMode() {
  if (touchState.active) return
  touchState.active = true
  if (typeof document !== 'undefined') document.documentElement.classList.add('touch-mode')
  touchModeSubs.forEach((cb) => cb(true))
}

// Called by TouchControls.jsx. Movement is analog here (magnitude 0..1),
// unlike the keyboard's unit vector.
export function setTouchMove(x, z) {
  inputState.move.x = x
  inputState.move.z = z
}

export function addTouchLook(dx, dy) {
  inputState.look.dx += dx
  inputState.look.dy += dy
}

export function addTouchZoom(dz) {
  inputState.zoom += dz
}

export function pressTouchJump() {
  inputState.jump = true
}

const held = new Set()
let orbiting = false
let installed = false

function recomputeMove() {
  let z = 0
  if (held.has('KeyW') || held.has('ArrowUp')) z += 1
  if (held.has('KeyS') || held.has('ArrowDown')) z -= 1
  inputState.move.z = z
}

function recomputeTurn() {
  let t = 0
  if (held.has('KeyA') || held.has('ArrowLeft')) t -= 1
  if (held.has('KeyD') || held.has('ArrowRight')) t += 1
  inputState.turn = t
}

function onKeyDown(e) {
  if (e.repeat) return
  held.add(e.code)
  if (e.code === 'Space') inputState.jump = true
  if (e.code === 'Escape') showMenu() // opens the portal's own pause menu
  recomputeMove()
  recomputeTurn()
}

function onKeyUp(e) {
  held.delete(e.code)
  recomputeMove()
  recomputeTurn()
}

// Middle or right mouse drag orbits the camera, matching Ice-Skate's scheme
// (left-click is reserved there for a fire action this template doesn't
// have, but kept the same here for parity/consistency if one is added).
function onPointerDown(e) {
  if (e.pointerType === 'touch') return
  if (e.button === 1 || e.button === 2) orbiting = true
}

function onPointerUp(e) {
  if (e.pointerType === 'touch') return
  if (e.button === 1 || e.button === 2) orbiting = false
}

function onPointerMove(e) {
  if (e.pointerType === 'touch') return
  if (!orbiting) return
  inputState.look.dx += e.movementX || 0
  inputState.look.dy += e.movementY || 0
}

function onWheel(e) {
  inputState.zoom += e.deltaY
}

function onContextMenu(e) {
  e.preventDefault() // right-drag is the orbit gesture
}

function onTouchStartDetect() {
  enableTouchMode()
}

function onBlur() {
  held.clear()
  orbiting = false
  inputState.jump = false
  recomputeMove()
  recomputeTurn()
}

export function install() {
  if (installed) return
  installed = true
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('wheel', onWheel, { passive: true })
  window.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('blur', onBlur)
  window.addEventListener('touchstart', onTouchStartDetect, { passive: true })

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    (navigator.maxTouchPoints || 0) > 0
  ) {
    enableTouchMode()
  }
}

export function uninstall() {
  if (!installed) return
  installed = false
  onBlur()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('wheel', onWheel)
  window.removeEventListener('contextmenu', onContextMenu)
  window.removeEventListener('blur', onBlur)
  window.removeEventListener('touchstart', onTouchStartDetect)
}
