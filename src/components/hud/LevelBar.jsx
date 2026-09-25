import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store/useGameStore.js'
import { levelProgress, canAcceptRebirth, clicksToNextLevel } from '../../data/progression.js'
import { auraStrengthMultiplier } from '../../data/aura.js'
import { formatShort } from '../../data/format.js'
import { useTouchMode } from './hooks.js'
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
  LEVEL_BAR_TOUCH,
} from '../../data/levelBar.js'

// Solid cartoon outline for the overlaid text — an 8-direction black shadow
// at stroke width s plus a soft drop. Ported from Ice-Skate's
// components/hud/LevelBar.jsx, with its PVP-zone health-bar section removed
// (this template has no PVP zone or player-health system).
const outline = (s, drop) =>
  `-${s}px -${s}px 0 #000, ${s}px -${s}px 0 #000, -${s}px ${s}px 0 #000, ${s}px ${s}px 0 #000,` +
  `0 -${s}px 0 #000, 0 ${s}px 0 #000, -${s}px 0 0 #000, ${s}px 0 0 #000,` +
  `0 ${drop}px ${drop * 2}px rgba(0,0,0,0.45)`

const FONT_STACK = `ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`
const S = LEVEL_BAR_TEXT_STROKE * LEVEL_BAR_SCALE * 0.75

// Desktop: fixed px sizes, shrunk as a whole by LEVEL_BAR_SCALE. Touch: its
// own smaller, viewport-clamped sizes at scale 1 (see LEVEL_BAR_TOUCH).
const LAYOUTS = {
  desktop: {
    wrapper: {
      top: LEVEL_BAR_TOP,
      width: LEVEL_BAR_WIDTH,
      maxWidth: `${LEVEL_BAR_MAX_VW}vw`,
      transform: `translateX(-50%) scale(${LEVEL_BAR_SCALE})`,
    },
    rebirth: { padding: '4px 52px', font: `800 30px/1 ${FONT_STACK}`, textShadow: outline(S, 4) },
    titleGap: 10,
    title: { font: `900 ${LEVEL_BAR_TITLE_FONT_PX}px/1 ${FONT_STACK}`, textShadow: outline(S, 4) },
    track: { height: LEVEL_BAR_HEIGHT, border: `${LEVEL_BAR_BORDER * 0.5}px solid #000`, boxShadow: '0 5px 0 rgba(0,0,0,0.28), inset 0 3px 5px rgba(0,0,0,0.12)' },
    labelPadding: '0 28px',
    // Thinner outline for the "Next Age Up in" pill label only.
    label: { font: `800 ${LEVEL_BAR_LABEL_FONT_PX}px/1 ${FONT_STACK}`, textShadow: outline(S * 0.5, 4) },
  },
  touch: {
    wrapper: {
      top: LEVEL_BAR_TOUCH.top,
      width: LEVEL_BAR_TOUCH.width,
      transform: 'translateX(-50%)',
    },
    rebirth: {
      padding: '2px 24px',
      font: `800 ${LEVEL_BAR_TOUCH.rebirthFont}/1 ${FONT_STACK}`,
      textShadow: outline(LEVEL_BAR_TOUCH.textStroke, 2),
    },
    titleGap: LEVEL_BAR_TOUCH.titleGap,
    title: { font: `900 ${LEVEL_BAR_TOUCH.titleFont}/1 ${FONT_STACK}`, textShadow: outline(LEVEL_BAR_TOUCH.textStroke, 2) },
    track: {
      height: LEVEL_BAR_TOUCH.height,
      border: `${LEVEL_BAR_TOUCH.border}px solid #000`,
      boxShadow: '0 3px 0 rgba(0,0,0,0.28), inset 0 2px 3px rgba(0,0,0,0.12)',
    },
    labelPadding: LEVEL_BAR_TOUCH.labelPadding,
    label: {
      font: `800 ${LEVEL_BAR_TOUCH.labelFont}/1 ${FONT_STACK}`,
      textShadow: outline(LEVEL_BAR_TOUCH.textStroke * 0.7, 2),
    },
  },
}

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
  const L = useTouchMode() ? LAYOUTS.touch : LAYOUTS.desktop

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
      style={{ ...L.wrapper, transformOrigin: 'top center' }}
    >
      <div style={{ textAlign: 'center', marginBottom: L.titleGap * 0.6 }}>
        <span
          ref={rebirthRef}
          style={{
            display: 'none',
            letterSpacing: 0.5,
            color: '#ffd21e',
            whiteSpace: 'nowrap',
            background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
            ...L.rebirth,
          }}
        >
          Rebirth Available
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: L.titleGap }}>
        <span ref={titleRef} style={{ display: 'inline-block', color: '#fff', whiteSpace: 'nowrap', ...L.title }}>
          Age: 0
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 9999,
            overflow: 'hidden',
            ...L.track,
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
              padding: L.labelPadding,
            }}
          >
            <span
              ref={barTextRef}
              style={{ display: 'inline-block', color: '#fff', whiteSpace: 'nowrap', ...L.label }}
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
