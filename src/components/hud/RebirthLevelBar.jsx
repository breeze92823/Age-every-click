import { useGameStore } from '../../store/useGameStore.js'
import { rebirthRequirement, clamp } from '../../data/progression.js'
import {
  LEVEL_BAR_WIDTH,
  LEVEL_BAR_HEIGHT,
  LEVEL_BAR_MAX_VW,
  LEVEL_BAR_BORDER,
  LEVEL_BAR_TEXT_STROKE,
  LEVEL_BAR_LABEL_FONT_PX,
  LEVEL_BAR_ICON_SIZE,
  LEVEL_BAR_ICON_OVERHANG,
  LEVEL_BAR_FILL_GRADIENT,
  LEVEL_BAR_ICON_URL,
  REBIRTH_LEVEL_BAR_TOUCH_SCALE,
} from '../../data/levelBar.js'

const S = LEVEL_BAR_TEXT_STROKE
const TEXT_OUTLINE =
  `-${S}px -${S}px 0 #000, ${S}px -${S}px 0 #000, -${S}px ${S}px 0 #000, ${S}px ${S}px 0 #000,` +
  `0 -${S}px 0 #000, 0 ${S}px 0 #000, -${S}px 0 0 #000, ${S}px 0 0 #000,` +
  `0 4px 8px rgba(0,0,0,0.45)`

// Visual twin of LevelBar.jsx's track, but plots progress toward the *next
// rebirth* — level against rebirthRequirement(rebirth) — instead of Speed
// toward the next character level. Used only inside the Rebirth modal.
// Ported verbatim from Ice-Skate's components/hud/RebirthLevelBar.jsx.
export default function RebirthLevelBar({ compact = false }) {
  const level = useGameStore((s) => s.level)
  const rebirth = useGameStore((s) => s.rebirth)
  const requirement = rebirthRequirement(rebirth)
  const frac = clamp(level / requirement, 0, 1)

  const scale = compact ? REBIRTH_LEVEL_BAR_TOUCH_SCALE : 1
  const height = LEVEL_BAR_HEIGHT * scale
  const border = LEVEL_BAR_BORDER * scale
  const iconSize = LEVEL_BAR_ICON_SIZE * scale
  const labelFont = `800 ${LEVEL_BAR_LABEL_FONT_PX * scale}px/1 ui-rounded, 'Nunito', system-ui, -apple-system, sans-serif`

  return (
    <div
      className="pointer-events-none"
      style={{ width: LEVEL_BAR_WIDTH * 0.5, maxWidth: `${LEVEL_BAR_MAX_VW * 0.5}vw`, margin: '0 auto' }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'relative',
            height,
            background: '#f4f4f4',
            border: `${border}px solid #000`,
            borderRadius: 9999,
            overflow: 'hidden',
            boxShadow: '0 5px 0 rgba(0,0,0,0.28), inset 0 3px 5px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(frac * 100).toFixed(2)}%`,
              background: LEVEL_BAR_FILL_GRADIENT,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: `0 ${Math.round(28 * scale)}px 0 ${Math.round(iconSize * 0.5)}px`,
            }}
          >
            <span style={{ font: labelFont, color: '#fff', textShadow: TEXT_OUTLINE }}>
              Level {level}/{requirement}
            </span>
          </div>
        </div>

        <img
          src={LEVEL_BAR_ICON_URL}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: -iconSize * LEVEL_BAR_ICON_OVERHANG,
            top: '50%',
            width: iconSize,
            height: iconSize,
            transform: 'translateY(-50%)',
            filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.4))',
          }}
        />
      </div>
    </div>
  )
}
