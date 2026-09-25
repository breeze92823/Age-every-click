import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store/useGameStore.js'
import { levelProgress, canAcceptRebirth, clicksToNextLevel } from '../../data/progression.js'
import { auraStrengthMultiplier } from '../../data/aura.js'
import { formatShort } from '../../data/format.js'
import {
  LEVEL_BAR_POLL_MS,
  LEVEL_BAR_SCALE,
  LEVEL_BAR_WIDTH,
  LEVEL_BAR_HEIGHT,
  LEVEL_BAR_MAX_VW,
  LEVEL_BAR_BORDER,
  LEVEL_BAR_TEXT_STROKE,
  LEVEL_BAR_LABEL_FONT_PX,
  LEVEL_BAR_TITLE_FONT_PX,
  LEVEL_BAR_TOP,
  LEVEL_BAR_TRANSITION_MS,
  LEVEL_BAR_AGE_FILL_GRADIENT,
  LEVEL_BAR_POP_MS,
} from '../../data/levelBar.js'

// Solid cartoon outline for the overlaid text — an 8-direction black shadow
// at LEVEL_BAR_TEXT_STROKE plus a soft drop. Ported from Ice-Skate's
// components/hud/LevelBar.jsx, with its PVP-zone health-bar section removed
// (this template has no PVP zone or player-health system).
const S = LEVEL_BAR_TEXT_STROKE * LEVEL_BAR_SCALE * 0.75
const TEXT_OUTLINE =
  `-${S}px -${S}px 0 #000, ${S}px -${S}px 0 #000, -${S}px ${S}px 0 #000, ${S}px ${S}px 0 #000,` +
  `0 -${S}px 0 #000, 0 ${S}px 0 #000, -${S}px 0 0 #000, ${S}px 0 0 #000,` +
  `0 4px 8px rgba(0,0,0,0.45)`

// Thinner outline for the "Next Age Up in" pill label only.
const BAR_S = S * 0.5
const BAR_TEXT_OUTLINE =
  `-${BAR_S}px -${BAR_S}px 0 #000, ${BAR_S}px -${BAR_S}px 0 #000, -${BAR_S}px ${BAR_S}px 0 #000, ${BAR_S}px ${BAR_S}px 0 #000,` +
  `0 -${BAR_S}px 0 #000, 0 ${BAR_S}px 0 #000, -${BAR_S}px 0 0 #000, ${BAR_S}px 0 0 #000,` +
  `0 4px 8px rgba(0,0,0,0.45)`

const TITLE_FONT = `900 ${LEVEL_BAR_TITLE_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`
const LABEL_FONT = `800 ${LEVEL_BAR_LABEL_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`

// Top-centre level bar. A DOM sibling of the canvas, never drei <Html>. A big
// "Age: N" heading sits above a pill track reading "Next Age Up in: N
// Click(s)". It must not re-render per frame: the structure below is built
// once, and every readout is written to the DOM from a throttled
// useGameStore.subscribe outside React.
export default function LevelBar() {
  const rebirthRef = useRef(null)
  const titleRef = useRef(null)
  const barTextRef = useRef(null)
  const fillRef = useRef(null)

  useEffect(() => {
    let last = 0
    let trailing = 0
    let prevTotal = null

    const pop = (el) => {
      if (!el) return
      el.style.animation = 'none'
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight // force reflow so the animation restarts
      el.style.animation = `level-bar-pop ${LEVEL_BAR_POP_MS}ms ease-out`
    }

    const paint = () => {
      last = performance.now()
      const { speed, rebirth, speedPerGain, equippedAura } = useGameStore.getState()
      const { level, total, frac } = levelProgress(speed)
      const gainPerClick = Math.floor(speedPerGain * (rebirth + 1) * auraStrengthMultiplier(equippedAura))
      const clicksLeft = clicksToNextLevel(speed, gainPerClick)
      if (rebirthRef.current)
        rebirthRef.current.style.display = canAcceptRebirth(level, rebirth) ? 'inline-block' : 'none'
      if (titleRef.current) {
        titleRef.current.textContent = `Age: ${formatShort(total)}`
        if (prevTotal !== null && total !== prevTotal) pop(titleRef.current)
      }
      if (barTextRef.current)
        barTextRef.current.textContent =
          clicksLeft > 0 ? `Next Age Up in: ${formatShort(clicksLeft)} Click${clicksLeft === 1 ? '' : 's'}` : 'Max Age Reached'
      if (fillRef.current) fillRef.current.style.width = `${(frac * 100).toFixed(2)}%`
      prevTotal = total
    }

    const schedule = () => {
      const wait = LEVEL_BAR_POLL_MS - (performance.now() - last)
      if (wait <= 0) {
        if (trailing) {
          clearTimeout(trailing)
          trailing = 0
        }
        paint()
      } else if (!trailing) {
        trailing = setTimeout(() => {
          trailing = 0
          paint()
        }, wait)
      }
    }

    paint()
    const unsub = useGameStore.subscribe(schedule)
    const poll = setInterval(paint, LEVEL_BAR_POLL_MS)
    return () => {
      if (trailing) clearTimeout(trailing)
      clearInterval(poll)
      unsub()
    }
  }, [])

  return (
    <div
      data-hud="level-bar"
      className="pointer-events-none absolute left-1/2"
      style={{
        top: LEVEL_BAR_TOP,
        width: LEVEL_BAR_WIDTH,
        maxWidth: `${LEVEL_BAR_MAX_VW}vw`,
        transform: `translateX(-50%) scale(${LEVEL_BAR_SCALE})`,
        transformOrigin: 'top center',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <span
          ref={rebirthRef}
          style={{
            display: 'none',
            padding: '4px 52px',
            font: `800 30px/1 ui-rounded, 'Nunito', system-ui, sans-serif`,
            letterSpacing: 0.5,
            color: '#ffd21e',
            textShadow: TEXT_OUTLINE,
            background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
          }}
        >
          Rebirth Available
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <span
          ref={titleRef}
          style={{ display: 'inline-block', font: TITLE_FONT, color: '#fff', textShadow: TEXT_OUTLINE }}
        >
          Age: 0
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            height: LEVEL_BAR_HEIGHT,
            background: 'rgba(0, 0, 0, 0.6)',
            border: `${LEVEL_BAR_BORDER * 0.5}px solid #000`,
            borderRadius: 9999,
            overflow: 'hidden',
            boxShadow: '0 5px 0 rgba(0,0,0,0.28), inset 0 3px 5px rgba(0,0,0,0.12)',
          }}
        >
          <div
            ref={fillRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '0%',
              background: LEVEL_BAR_AGE_FILL_GRADIENT,
              transition: `width ${LEVEL_BAR_TRANSITION_MS}ms ease-out`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 28px',
            }}
          >
            <span
              ref={barTextRef}
              style={{ display: 'inline-block', font: LABEL_FONT, color: '#fff', textShadow: BAR_TEXT_OUTLINE }}
            >
              Next Age Up in: 5 Clicks
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes level-bar-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.28); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
