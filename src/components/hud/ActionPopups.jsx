import { useEffect, useRef } from 'react'
import { actionPopupPool } from '../../systems/actionPopups.js'
import {
  ACTION_POPUP_POOL_SIZE,
  ACTION_POPUP_LIFETIME,
  ACTION_POPUP_FADE_IN,
  ACTION_POPUP_FADE_OUT_START,
  ACTION_POPUP_POP_T,
  ACTION_POPUP_POP_SCALE_FROM,
  ACTION_POPUP_POP_OVERSHOOT,
  ACTION_POPUP_HOP,
  ACTION_POPUP_TARGET_Y,
  ACTION_POPUP_CENTER_PULL,
  ACTION_POPUP_IMAGE_SIZE,
  ACTION_POPUP_FONT_SIZE,
  ACTION_POPUP_IMAGE_URL,
} from '../../data/actionPopups.js'

const FADE_IN_T = ACTION_POPUP_FADE_IN / ACTION_POPUP_LIFETIME

// easeOutBack — scale springs past 1, then settles: a punchy spawn.
function easeOutBack(p) {
  const c1 = ACTION_POPUP_POP_OVERSHOOT
  const c3 = c1 + 1
  const q = p - 1
  return 1 + c3 * q * q * q + c1 * q * q
}

// easeInOutCubic — the sweep down accelerates out of the pop, eases into
// the landing.
function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
}

// One DOM node per pool slot in systems/actionPopups.js, created once and
// recycled — never mounted/unmounted per popup. A self-owned rAF loop reads
// the pool and writes transform/opacity straight onto the nodes. Ported
// verbatim from Ice-Skate's components/hud/ActionPopups.jsx, except it
// travels up toward the top-of-screen "Age: N" heading instead of down.
export default function ActionPopups() {
  const nodesRef = useRef([])

  useEffect(() => {
    let raf = 0
    const drawnSeq = new Array(ACTION_POPUP_POOL_SIZE).fill(-1)

    const frame = () => {
      const nodes = nodesRef.current
      for (let i = 0; i < ACTION_POPUP_POOL_SIZE; i++) {
        const slot = actionPopupPool[i]
        const node = nodes[i]
        if (!node) continue

        if (!slot.alive) {
          if (node.style.display !== 'none') {
            node.style.display = 'none'
            drawnSeq[i] = -1
          }
          continue
        }

        if (drawnSeq[i] !== slot.seq) {
          drawnSeq[i] = slot.seq
          node.firstElementChild.nextElementSibling.textContent = `+${slot.amount}`
          node.style.display = ''
        }

        const t = slot.age / ACTION_POPUP_LIFETIME
        const pop = t < ACTION_POPUP_POP_T ? t / ACTION_POPUP_POP_T : 1
        const travel = t <= ACTION_POPUP_POP_T ? 0 : (t - ACTION_POPUP_POP_T) / (1 - ACTION_POPUP_POP_T)
        const te = easeInOutCubic(travel)

        let scale = ACTION_POPUP_POP_SCALE_FROM + (1 - ACTION_POPUP_POP_SCALE_FROM) * easeOutBack(pop)
        scale *= 1 - 0.18 * te

        const hop = Math.sin(pop * Math.PI) * ACTION_POPUP_HOP
        const curNdcX = slot.ndcX * (1 - ACTION_POPUP_CENTER_PULL * te)
        const curNdcY = slot.ndcY + (ACTION_POPUP_TARGET_Y - slot.ndcY) * te + hop
        const leftPct = (curNdcX * 0.5 + 0.5) * 100
        const topPct = (-curNdcY * 0.5 + 0.5) * 100

        let opacity
        if (t < FADE_IN_T) opacity = t / FADE_IN_T
        else if (t < ACTION_POPUP_FADE_OUT_START) opacity = 1
        else opacity = 1 - (t - ACTION_POPUP_FADE_OUT_START) / (1 - ACTION_POPUP_FADE_OUT_START)

        node.style.left = `${leftPct}%`
        node.style.top = `${topPct}%`
        node.style.opacity = String(opacity < 0 ? 0 : opacity)
        node.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const slots = []
  for (let i = 0; i < ACTION_POPUP_POOL_SIZE; i++) {
    slots.push(
      <div
        key={i}
        ref={(el) => {
          nodesRef.current[i] = el
        }}
        className="pointer-events-none absolute flex items-center"
        style={{
          display: 'none',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%) scale(0)',
          willChange: 'transform, opacity',
        }}
      >
        <img
          src={ACTION_POPUP_IMAGE_URL}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: ACTION_POPUP_IMAGE_SIZE,
            height: 'auto',
            filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))',
          }}
        />
        <span
          className="font-mono font-extrabold text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.95),0_0_3px_rgba(0,0,0,0.9)]"
          style={{
            fontSize: ACTION_POPUP_FONT_SIZE,
            whiteSpace: 'nowrap',
            marginLeft: Math.round(ACTION_POPUP_FONT_SIZE * 0.3),
          }}
        />
      </div>,
    )
  }

  return <div className="pointer-events-none fixed inset-0 overflow-hidden">{slots}</div>
}
