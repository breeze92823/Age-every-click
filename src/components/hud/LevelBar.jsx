import { useEffect, useMemo, useRef } from 'react'
import { useGameStore } from '../../store/useGameStore.js'
import { levelProgress, canAcceptRebirth } from '../../data/progression.js'
import { formatShort } from '../../data/format.js'
import { makeStudOverlayDataURL } from '../../systems/studTexture.js'
import {
  LEVEL_BAR_POLL_MS,
  LEVEL_BAR_WIDTH,
  LEVEL_BAR_HEIGHT,
  LEVEL_BAR_MAX_VW,
  LEVEL_BAR_BORDER,
  LEVEL_BAR_TEXT_STROKE,
  LEVEL_BAR_CAPTION_FONT_PX,
  LEVEL_BAR_LABEL_FONT_PX,
  LEVEL_BAR_BOTTOM,
  LEVEL_BAR_TRANSITION_MS,
  LEVEL_BAR_FILL_GRADIENT,
  LEVEL_BAR_CAPTION_BAND,
  LEVEL_BAR_CAPTION_BAND_PAD_X,
  LEVEL_BAR_CAPTION_BAND_PAD_Y,
  LEVEL_BAR_REBIRTH_TEXT_COLOR,
  LEVEL_BAR_STUD_PITCH,
  LEVEL_BAR_RADIUS,
} from '../../data/levelBar.js'

// Solid cartoon outline for the overlaid text — an 8-direction black shadow
// at LEVEL_BAR_TEXT_STROKE plus a soft drop. Ported from Ice-Skate's
// components/hud/LevelBar.jsx, with its PVP-zone health-bar section removed
// (this template has no PVP zone or player-health system).
const S = LEVEL_BAR_TEXT_STROKE
const TEXT_OUTLINE =
  `-${S}px -${S}px 0 #000, ${S}px -${S}px 0 #000, -${S}px ${S}px 0 #000, ${S}px ${S}px 0 #000,` +
  `0 -${S}px 0 #000, 0 ${S}px 0 #000, -${S}px 0 0 #000, ${S}px 0 0 #000,` +
  `0 4px 8px rgba(0,0,0,0.45)`

const LABEL_FONT = `800 ${LEVEL_BAR_LABEL_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`

// Bottom-centre level bar. A DOM sibling of the canvas, never drei <Html>.
// It must not re-render per frame: the structure below is built once, and
// every readout is written to the DOM from a throttled useGameStore.subscribe
// outside React.
export default function LevelBar() {
  const rebirthRef = useRef(null)
  const rebirthCountRef = useRef(null)
  const captionRef = useRef(null)
  const levelRef = useRef(null)
  const countRef = useRef(null)
  const fillRef = useRef(null)

  const studOverlay = useMemo(() => `url(${makeStudOverlayDataURL(LEVEL_BAR_STUD_PITCH)})`, [])

  useEffect(() => {
    let last = 0
    let trailing = 0

    const paint = () => {
      last = performance.now()
      const { speed, rebirth } = useGameStore.getState()
      const { level, frac, total, needed } = levelProgress(speed)
      if (rebirthRef.current)
        rebirthRef.current.style.display = canAcceptRebirth(level, rebirth) ? 'inline-block' : 'none'
      if (rebirthCountRef.current) rebirthCountRef.current.textContent = `Rebirth (X${rebirth})`
      if (captionRef.current) captionRef.current.textContent = `${formatShort(speed)} Speed`
      if (levelRef.current) levelRef.current.textContent = `Level ${level}`
      if (countRef.current) countRef.current.textContent = `${formatShort(total)} / ${formatShort(needed)}`
      if (fillRef.current) fillRef.current.style.width = `${(frac * 100).toFixed(2)}%`
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
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ bottom: LEVEL_BAR_BOTTOM, width: LEVEL_BAR_WIDTH, maxWidth: `${LEVEL_BAR_MAX_VW}vw` }}
    >
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <span
          ref={rebirthCountRef}
          style={{
            display: 'inline-block',
            padding: `${LEVEL_BAR_CAPTION_BAND_PAD_Y}px ${LEVEL_BAR_CAPTION_BAND_PAD_X}px`,
            font: `800 ${LEVEL_BAR_CAPTION_FONT_PX * 0.6}px/1 ui-rounded, 'Nunito', system-ui, sans-serif`,
            letterSpacing: 0.5,
            color: LEVEL_BAR_REBIRTH_TEXT_COLOR,
            textShadow: TEXT_OUTLINE,
          }}
        >
          Rebirth (X0)
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <span
          ref={rebirthRef}
          style={{
            display: 'none',
            padding: `${LEVEL_BAR_CAPTION_BAND_PAD_Y}px ${LEVEL_BAR_CAPTION_BAND_PAD_X}px`,
            font: `800 ${LEVEL_BAR_CAPTION_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, sans-serif`,
            letterSpacing: 0.5,
            color: '#ffd21e',
            textShadow: TEXT_OUTLINE,
            background: LEVEL_BAR_CAPTION_BAND,
          }}
        >
          Rebirth Available
        </span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <span
          ref={captionRef}
          style={{
            display: 'inline-block',
            padding: `${LEVEL_BAR_CAPTION_BAND_PAD_Y}px ${LEVEL_BAR_CAPTION_BAND_PAD_X}px`,
            font: `800 ${LEVEL_BAR_CAPTION_FONT_PX}px/1 ui-rounded, 'Nunito', system-ui, sans-serif`,
            letterSpacing: 0.5,
            color: '#fff',
            textShadow: TEXT_OUTLINE,
            background: LEVEL_BAR_CAPTION_BAND,
          }}
        >
          1 Speed
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            height: LEVEL_BAR_HEIGHT,
            background: `${studOverlay}, #f4f4f4`,
            backgroundRepeat: 'repeat, no-repeat',
            backgroundSize: `${LEVEL_BAR_STUD_PITCH}px ${LEVEL_BAR_STUD_PITCH}px, 100% 100%`,
            border: `${LEVEL_BAR_BORDER}px solid #000`,
            borderRadius: LEVEL_BAR_RADIUS,
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
              background: `${studOverlay}, ${LEVEL_BAR_FILL_GRADIENT}`,
              backgroundRepeat: 'repeat, no-repeat',
              backgroundSize: `${LEVEL_BAR_STUD_PITCH}px ${LEVEL_BAR_STUD_PITCH}px, 100% 100%`,
              transition: `width ${LEVEL_BAR_TRANSITION_MS}ms ease-out`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 28px',
            }}
          >
            <span ref={levelRef} style={{ font: LABEL_FONT, color: '#fff', textShadow: TEXT_OUTLINE }}>
              Level 1
            </span>
            <span ref={countRef} style={{ font: LABEL_FONT, color: '#fff', textShadow: TEXT_OUTLINE }}>
              1 / 50
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
