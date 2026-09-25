import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store/useGameStore.js'
import { playLevelUp } from '../../systems/sfx.js'
import {
  LEVEL_UP_POPUP_TITLE,
  LEVEL_UP_POPUP_SUBLABEL,
  LEVEL_UP_POPUP_TOP,
  LEVEL_UP_POPUP_IN_MS,
  LEVEL_UP_POPUP_HOLD_MS,
  LEVEL_UP_POPUP_OUT_MS,
  LEVEL_UP_POPUP_POP_SCALE_FROM,
  LEVEL_UP_POPUP_POP_OVERSHOOT,
  LEVEL_UP_POPUP_RISE,
  LEVEL_UP_POPUP_TITLE_FONT_PX,
  LEVEL_UP_POPUP_SUB_FONT_PX,
  LEVEL_UP_POPUP_TEXT_STROKE,
  LEVEL_UP_POPUP_TITLE_COLOR,
} from '../../data/levelUpPopup.js'

const S = LEVEL_UP_POPUP_TEXT_STROKE
const TEXT_OUTLINE =
  `-${S}px -${S}px 0 #000, ${S}px -${S}px 0 #000, -${S}px ${S}px 0 #000, ${S}px ${S}px 0 #000,` +
  `0 -${S}px 0 #000, 0 ${S}px 0 #000, -${S}px 0 0 #000, ${S}px 0 0 #000,` +
  `0 6px 12px rgba(0,0,0,0.5)`

const TOTAL_MS = LEVEL_UP_POPUP_IN_MS + LEVEL_UP_POPUP_HOLD_MS + LEVEL_UP_POPUP_OUT_MS

// Top-centre "LEVEL UP!" banner. A DOM sibling of the canvas, never
// re-renders per frame — a transient useGameStore.subscribe watches `level`
// and runs one Web-Animations pass (pop in, hold, float up and fade) on any
// rise. Rebirth drops `level` back to 1 — a fall, so no banner. Ported
// verbatim from Ice-Skate's components/hud/LevelUpPopup.jsx.
export default function LevelUpPopup() {
  const rootRef = useRef(null)
  const subRef = useRef(null)

  useEffect(() => {
    let lastLevel = useGameStore.getState().level
    let anim = null

    const play = (level) => {
      const root = rootRef.current
      if (!root) return
      if (subRef.current) subRef.current.textContent = LEVEL_UP_POPUP_SUBLABEL(level)

      if (anim) anim.cancel()
      root.style.display = ''
      anim = root.animate(
        [
          {
            opacity: 0,
            transform: `translateX(-50%) translateY(14px) scale(${LEVEL_UP_POPUP_POP_SCALE_FROM})`,
            offset: 0,
          },
          {
            opacity: 1,
            transform: `translateX(-50%) translateY(0) scale(${LEVEL_UP_POPUP_POP_OVERSHOOT})`,
            offset: (LEVEL_UP_POPUP_IN_MS * 0.62) / TOTAL_MS,
          },
          {
            opacity: 1,
            transform: 'translateX(-50%) translateY(0) scale(1)',
            offset: LEVEL_UP_POPUP_IN_MS / TOTAL_MS,
          },
          {
            opacity: 1,
            transform: 'translateX(-50%) translateY(0) scale(1)',
            offset: (LEVEL_UP_POPUP_IN_MS + LEVEL_UP_POPUP_HOLD_MS) / TOTAL_MS,
          },
          {
            opacity: 0,
            transform: `translateX(-50%) translateY(-${LEVEL_UP_POPUP_RISE}px) scale(1)`,
            offset: 1,
          },
        ],
        { duration: TOTAL_MS, easing: 'ease-out', fill: 'forwards' },
      )
      anim.onfinish = () => {
        if (rootRef.current) rootRef.current.style.display = 'none'
      }
    }

    const unsub = useGameStore.subscribe((state) => {
      if (state.level > lastLevel) {
        play(state.level)
        playLevelUp()
      }
      lastLevel = state.level
    })

    return () => {
      unsub()
      if (anim) anim.cancel()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute left-1/2"
      style={{
        display: 'none',
        top: LEVEL_UP_POPUP_TOP,
        transform: 'translateX(-50%)',
        textAlign: 'center',
        willChange: 'transform, opacity',
      }}
    >
      <div
        style={{
          font: `900 ${LEVEL_UP_POPUP_TITLE_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`,
          letterSpacing: 1,
          color: LEVEL_UP_POPUP_TITLE_COLOR,
          textShadow: TEXT_OUTLINE,
        }}
      >
        {LEVEL_UP_POPUP_TITLE}
      </div>
      <div
        ref={subRef}
        style={{
          marginTop: 6,
          font: `800 ${LEVEL_UP_POPUP_SUB_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`,
          letterSpacing: 0.5,
          color: '#fff',
          textShadow: TEXT_OUTLINE,
        }}
      >
        {LEVEL_UP_POPUP_SUBLABEL(1)}
      </div>
    </div>
  )
}
