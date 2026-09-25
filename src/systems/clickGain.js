import { useGameStore } from '../store/useGameStore.js'
import { spawnActionPopup } from './actionPopups.js'

// A click or tap anywhere on the 3D view grants one gainSpeed() worth of
// Age, with a "+N" popup. Only the canvas (and the touch camera zone, which
// covers it on phones — marked data-click-gain) counts, so HUD buttons and
// the joystick/jump button never trigger it, and a press that moved further
// than DRAG_PX is a camera drag, not a click.

const DRAG_PX = 10
// Spam-clicking is throttled to one gain per this window, no matter how many
// clicks/taps land inside it.
const GAIN_INTERVAL_MS = 1000
const presses = new Map()
let installed = false
let lastGainAt = -Infinity

function isClickSurface(el) {
  return el?.tagName === 'CANVAS' || el?.dataset?.clickGain !== undefined
}

function onPointerDown(e) {
  if (!isClickSurface(e.target)) return
  if (e.pointerType !== 'touch' && e.button !== 0) return
  presses.set(e.pointerId, { x: e.clientX, y: e.clientY })
}

function onPointerUp(e) {
  const start = presses.get(e.pointerId)
  if (!start) return
  presses.delete(e.pointerId)
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_PX) return
  // Riding an Age Machine locks out every action, not just movement — see
  // useGameStore's ridingAgeMachine.
  if (useGameStore.getState().ridingAgeMachine != null) return
  const now = performance.now()
  if (now - lastGainAt < GAIN_INTERVAL_MS) return
  lastGainAt = now
  spawnActionPopup(useGameStore.getState().gainSpeed())
}

function onPointerCancel(e) {
  presses.delete(e.pointerId)
}

export function install() {
  if (installed) return
  installed = true
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}
