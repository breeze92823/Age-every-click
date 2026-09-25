import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useGameStore } from '../../store/useGameStore.js'
import { WHEEL_PRIZES, SPIN_PRICE_COINS } from '../../data/luckyWheel.js'
import { formatCompact } from '../../systems/format.js'
import { playButtonClick, playButtonHover, playLevelUp, playActionFail } from '../../systems/sfx.js'

// Lucky Wheel popup, opened with E at the Statue (systems/statueInteract.js
// -> the store's openWheel). Five equal slices laid out clockwise from the
// top in WHEEL_PRIZES order; the spin is rolled up front by the store's
// spinWheel and the wheel just animates to land that slice under the fixed
// pointer, then the prize is applied via claimWheelPrize. Closing is blocked
// mid-spin so a rolled prize can never be lost.
//
// Everything is sized in em off one root font-size derived from the popup's
// width, so the whole thing scales together on phones and desktops.

const SLICE_DEG = 360 / WHEEL_PRIZES.length
const SPIN_MS = 5000
const EXTRA_TURNS = 6
const R_RING = 98
const R_SLICE = 90

const OUTLINE = { WebkitTextStroke: '0.07em black', paintOrder: 'stroke fill' }

// Slice i spans SLICE_DEG centred on i * SLICE_DEG clockwise from 12 o'clock.
function slicePath(i) {
  const point = (deg) => {
    const rad = (deg * Math.PI) / 180
    return `${(R_SLICE * Math.sin(rad)).toFixed(3)},${(-R_SLICE * Math.cos(rad)).toFixed(3)}`
  }
  const a = i * SLICE_DEG - SLICE_DEG / 2
  const b = i * SLICE_DEG + SLICE_DEG / 2
  return `M0,0 L${point(a)} A${R_SLICE},${R_SLICE} 0 0 1 ${point(b)} Z`
}

const SLICE_LINES = {
  age500: ['500', 'Age'],
  coins3000: ['3,000'],
  ageBoost: ['x2 Age', '(30s)'],
  age200: ['200', 'Age'],
  speedCoil: ['X2 Click', 'Gain'],
}

function PrizeIcon({ kind }) {
  if (kind === 'age') {
    const arrow = 'M-9,3 L0,-10 L9,3 L3.5,3 L3.5,11 L-3.5,11 L-3.5,3 Z'
    return (
      <g stroke="#0b2540" strokeWidth="1.6" strokeLinejoin="round" fill="#eaf6ff">
        <path d={arrow} transform="translate(-4,-3)" />
        <path d={arrow} transform="translate(4,3)" />
      </g>
    )
  }
  if (kind === 'speedCoil') {
    const d = 'M-10,-10 Q0,-15 10,-8 M-10,-3 Q0,-8 10,-1 M-10,4 Q0,-1 10,6 M-10,11 Q0,6 10,13'
    return (
      <g fill="none" strokeLinecap="round">
        <path d={d} stroke="#3b0a12" strokeWidth="6" />
        <path d={d} stroke="#ff7d92" strokeWidth="3.4" />
      </g>
    )
  }
  const emoji = kind === 'coins' ? '🪙' : '🚀'
  return (
    <text textAnchor="middle" dominantBaseline="central" fontSize="22" style={{ filter: 'saturate(1.3)' }}>
      {emoji}
    </text>
  )
}

function WheelFace() {
  return (
    <svg viewBox="-100 -100 200 200" className="h-full w-full">
      <circle r={R_RING} fill="#fff" stroke="#000" strokeWidth="2.5" />
      {WHEEL_PRIZES.map((prize, i) => (
        <path key={prize.id} d={slicePath(i)} fill={prize.color} stroke="#000" strokeWidth="2.5" strokeLinejoin="round" />
      ))}
      {WHEEL_PRIZES.map((prize, i) => (
        <g key={prize.id} transform={`rotate(${i * SLICE_DEG})`} textAnchor="middle" fontWeight="900" fill="#fff">
          <g transform="translate(0,-60)">
            <PrizeIcon kind={prize.kind} />
          </g>
          {SLICE_LINES[prize.id].map((line, n, all) => (
            <text
              key={line}
              y={-38 + (n - (all.length - 1) / 2) * 8.5 + (all.length === 1 ? 4 : 0)}
              fontSize="8.5"
              stroke="#000"
              strokeWidth="2.4"
              strokeLinejoin="round"
              style={{ paintOrder: 'stroke fill' }}
              dominantBaseline="central"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}

// Fixed above the spinning face: the hub cap and the red pointer at 12 o'clock.
function WheelOverlay() {
  return (
    <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <circle r="12" fill="#ff9d1a" stroke="#000" strokeWidth="2.5" />
      <circle r="8" fill="#ffc45c" stroke="#b45f06" strokeWidth="1.5" />
      <path d="M-17,-112 L17,-112 L0,-80 Z" fill="#ff1f1f" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-9,-107 L9,-107 L0,-92 Z" fill="#ff6b6b" />
    </svg>
  )
}

const GREEN_BTN =
  'flex items-center justify-center gap-[0.3em] rounded-[0.35em] border-[0.1em] border-black bg-gradient-to-b from-lime-400 to-green-600 px-[0.4em] py-[0.15em] font-black text-white shadow-[0_0.1em_0_rgba(0,0,0,0.45)] transition hover:brightness-110 active:translate-y-[0.05em] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100'

function WheelWindow() {
  const spins = useGameStore((s) => s.spins)
  const closeWheel = useGameStore((s) => s.closeWheel)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState(null) // { text, ok }
  const rotationRef = useRef(0)
  const timerRef = useRef(0)

  const close = () => {
    if (spinning) return
    playButtonClick()
    closeWheel()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && !spinning) closeWheel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spinning, closeWheel])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const fail = (text) => {
    playActionFail()
    setMessage({ text, ok: false })
  }

  const onSpin = () => {
    if (spinning) return
    const index = useGameStore.getState().spinWheel()
    if (index < 0) {
      fail('No spins left — buy more below!')
      return
    }
    playButtonClick()
    setMessage(null)
    setSpinning(true)

    // Land somewhere inside the rolled slice (not always dead-centre) under
    // the pointer, after a few full turns.
    const jitter = (Math.random() - 0.5) * SLICE_DEG * 0.7
    const current = rotationRef.current
    const toSlice = (((jitter - index * SLICE_DEG - current) % 360) + 360) % 360
    const next = current + toSlice + 360 * EXTRA_TURNS
    rotationRef.current = next
    setRotation(next)

    timerRef.current = setTimeout(() => {
      const text = useGameStore.getState().claimWheelPrize(index)
      playLevelUp()
      setMessage({ text, ok: true })
      setSpinning(false)
    }, SPIN_MS + 150)
  }

  const onBuyWithCoins = () => {
    if (spinning) return
    if (useGameStore.getState().buySpinWithCoins()) {
      playButtonClick()
      setMessage({ text: '+1 Spin!', ok: true })
    } else {
      fail(`Need ${formatCompact(SPIN_PRICE_COINS)} Coins to buy a spin`)
    }
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="relative flex flex-col items-center"
        style={{ width: 'min(76vh, 92vw)', fontSize: 'calc(min(76vh, 92vw) * 0.055)' }}
      >
        <button
          type="button"
          onClick={close}
          disabled={spinning}
          aria-label="Close"
          className="absolute -right-[0.3em] top-0 z-10 flex h-[1.5em] w-[1.5em] items-center justify-center rounded-[0.25em] border-[0.1em] border-black bg-red-600 text-[1.1em] font-black leading-none text-white shadow-[0_0.1em_0_rgba(0,0,0,0.45)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ✕
        </button>

        <div className="relative mt-[0.9em] aspect-square w-[88%]">
          <div
            className="h-full w-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.08, 1)` : 'none',
              filter: 'drop-shadow(0 0.15em 0.3em rgba(0,0,0,0.5))',
            }}
          >
            <WheelFace />
          </div>
          <WheelOverlay />
        </div>

        <div className="flex h-[1.5em] items-center justify-center" style={{ fontSize: '0.8em' }}>
          {message && (
            <span
              className={`rounded-full border-2 border-black bg-black/70 px-[0.8em] py-[0.1em] font-black ${
                message.ok ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {message.text}
            </span>
          )}
        </div>

        <div className="mx-auto mt-[0.2em] grid w-[70%] grid-cols-[1fr_1.5fr] items-end gap-[0.5em]">
          <div className="flex flex-col items-stretch gap-[0.2em]">
            <span
              className="rounded-[0.3em] border-[0.08em] border-black bg-black/80 py-[0.1em] text-center font-black text-white"
              style={{ fontSize: '0.6em' }}
            >
              +1 Spins
            </span>
            <button
              type="button"
              onClick={onBuyWithCoins}
              onMouseEnter={playButtonHover}
              disabled={spinning}
              className={GREEN_BTN}
              style={OUTLINE}
            >
              <span aria-hidden="true">🪙</span>
              <span>{formatCompact(SPIN_PRICE_COINS)}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onSpin}
            onMouseEnter={playButtonHover}
            disabled={spinning}
            className={`${GREEN_BTN} py-[0.3em] text-[1.15em]`}
            style={OUTLINE}
          >
            (x{spins}) SPIN
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LuckyWheel() {
  const open = useGameStore((s) => s.wheelOpen)
  if (!open) return null
  return createPortal(<WheelWindow />, document.body)
}
