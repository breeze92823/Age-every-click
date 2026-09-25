import { useEffect, useReducer, useRef } from 'react'
import { setTouchMove, addTouchLook, addTouchZoom, pressTouchJump, pressTouchInteract } from '../../systems/input.js'
import { useInteractPrompt } from '../../systems/interactPrompt.js'
import { useTouchMode } from './hooks.js'

// On-screen controls for a touch session. DOM siblings of the canvas like
// the rest of the HUD — this never re-renders per frame: gestures write the
// input singleton directly through the setters in systems/input.js. The
// only React state here is the transient joystick thumb position.
//
// Layout, matched to a phone held in two hands:
//   left  ~45% / lower  ~58%  → floating movement stick
//   right ~54%                → drag to orbit the camera, pinch to zoom
//   bottom-right              → Jump

const STICK_RADIUS = 54 // px; thumb travel that maps to full-speed movement
const DEAD_ZONE = 0.16 // fraction of the radius ignored before the character moves
const LOOK_SENS = 0.75 // touch drag px -> same units cameraOrbit expects from a mouse
const PINCH_ZOOM = 2.5 // pinch distance px -> wheel-equivalent zoom units

// One-finger drag on this half orbits the camera; two fingers pinch-zoom.
function LookZone() {
  const pointers = useRef(new Map())
  const lastPinch = useRef(0)

  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) lastPinch.current = dist()
  }

  const onMove = (e) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, next)

    if (pointers.current.size >= 2) {
      const d = dist()
      if (lastPinch.current) addTouchZoom((lastPinch.current - d) * PINCH_ZOOM)
      lastPinch.current = d
      return
    }
    addTouchLook((next.x - prev.x) * LOOK_SENS, (next.y - prev.y) * LOOK_SENS)
  }

  const onUp = (e) => {
    pointers.current.delete(e.pointerId)
    lastPinch.current = 0
  }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      data-click-gain
      className="pointer-events-auto fixed right-0 top-0 bottom-0"
      style={{ left: '46%', touchAction: 'none' }}
    />
  )
}

// Floating stick: the base springs to wherever the thumb lands inside the
// lower-left wedge, so it never has to be found by feel.
function MoveStick() {
  const [, force] = useReducer((n) => n + 1, 0)
  const stick = useRef(null) // { id, ox, oy, tx, ty } in viewport px, or null

  const publish = () => {
    const s = stick.current
    if (!s) return setTouchMove(0, 0)
    let x = (s.tx - s.ox) / STICK_RADIUS
    let y = (s.ty - s.oy) / STICK_RADIUS
    let mag = Math.hypot(x, y)
    if (mag > 1) {
      x /= mag
      y /= mag
      mag = 1
    }
    if (mag < DEAD_ZONE) return setTouchMove(0, 0)
    const k = (mag - DEAD_ZONE) / (1 - DEAD_ZONE) / mag
    setTouchMove(x * k, -y * k) // screen up (-y) is forward (+z)
  }

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, tx: e.clientX, ty: e.clientY }
    force()
  }

  const onMove = (e) => {
    const s = stick.current
    if (!s || s.id !== e.pointerId) return
    s.tx = e.clientX
    s.ty = e.clientY
    publish()
    force()
  }

  const onUp = (e) => {
    if (stick.current && stick.current.id !== e.pointerId) return
    stick.current = null
    setTouchMove(0, 0)
    force()
  }

  const s = stick.current
  let knobX = 0
  let knobY = 0
  if (s) {
    knobX = s.tx - s.ox
    knobY = s.ty - s.oy
    const mag = Math.hypot(knobX, knobY)
    if (mag > STICK_RADIUS) {
      knobX = (knobX / mag) * STICK_RADIUS
      knobY = (knobY / mag) * STICK_RADIUS
    }
  }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="pointer-events-auto fixed bottom-0 left-0"
      style={{ width: '45%', height: '58%', touchAction: 'none' }}
    >
      {s && (
        <>
          <div
            className="fixed rounded-full border border-white/40 bg-white/5"
            style={{
              left: s.ox - STICK_RADIUS,
              top: s.oy - STICK_RADIUS,
              width: STICK_RADIUS * 2,
              height: STICK_RADIUS * 2,
              zIndex: 35,
            }}
          />
          <div
            className="fixed rounded-full border border-white/70 bg-white/25 backdrop-blur-sm"
            style={{
              left: s.ox - 26 + knobX,
              top: s.oy - 26 + knobY,
              width: 52,
              height: 52,
              zIndex: 35,
            }}
          />
        </>
      )}
    </div>
  )
}

function JumpButton() {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pressTouchJump()
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto fixed select-none rounded-full border border-white/35 bg-slate-900/55 text-sm font-bold tracking-wide text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95"
      style={{
        width: 'clamp(56px, 13vmin, 76px)',
        height: 'clamp(56px, 13vmin, 76px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 18px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)',
        touchAction: 'none',
        zIndex: 40,
      }}
    >
      JUMP
    </button>
  )
}

// Only rendered while an obby entry pad's "Press E" prompt is armed (see
// systems/interactPrompt.js and systems/scenePortals.js) — touch has no E
// key, so this is its equivalent of pressing it.
function InteractButton() {
  const label = useInteractPrompt((s) => s.label)
  if (!label) return null

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pressTouchInteract()
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto fixed select-none rounded-full border border-white/35 bg-slate-900/55 text-sm font-bold tracking-wide text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95"
      style={{
        width: 'clamp(56px, 13vmin, 76px)',
        height: 'clamp(56px, 13vmin, 76px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 18px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 108px)',
        touchAction: 'none',
        zIndex: 40,
      }}
    >
      USE
    </button>
  )
}

export default function TouchControls() {
  const on = useTouchMode()

  // Backgrounding the tab mid-gesture must not leave the character walking.
  // systems/input.js clears the singleton on window blur too; this keeps
  // our own visuals honest.
  useEffect(() => {
    if (!on) return
    const stop = () => setTouchMove(0, 0)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
    }
  }, [on])

  if (!on) return null

  return (
    <div className="pointer-events-none fixed inset-0" style={{ touchAction: 'none' }}>
      <LookZone />
      <MoveStick />
      <JumpButton />
      <InteractButton />
    </div>
  )
}
