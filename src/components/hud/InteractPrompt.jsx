import { useInteractPrompt } from '../../systems/interactPrompt.js'

// Bottom-center "Hold E to ..." pill for the island's obby entry pads
// (Impossible Bridge, Stud Jumps, Tsunami Escape) — systems/scenePortals.js
// arms the label via setInteractPrompt while the player stands on a pad, and
// its progress (0..1) drives the ring below and the pop-up-bigger scale
// while E is held, clearing both once the hold completes or the player
// steps off/lets go. Structure/behavior ported from Ice-Skate's
// InteractPrompt (components/hud/Hud.jsx there): a keyWrap span holds the
// ring + key glyph and gains a blurred backing once held, the label hides,
// and the whole pill scales up — just re-rendered from the zustand store
// each frame instead of Ice-Skate's imperative ref/classList writes, since
// this HUD already renders that way elsewhere.
const RING_SIZE = 32
const RING_RADIUS = 14
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export default function InteractPrompt() {
  const label = useInteractPrompt((s) => s.label)
  const progress = useInteractPrompt((s) => s.progress)

  if (!label) return null

  const held = progress > 0
  const offset = RING_CIRCUMFERENCE * (1 - progress)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-30 flex justify-center">
      <div
        className={`flex items-center gap-2 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          held ? 'scale-150' : 'scale-100 border-2 border-black bg-black/70 px-5 py-2'
        }`}
        style={{ WebkitTextStroke: '1px black', paintOrder: 'stroke fill' }}
      >
        <span
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center transition-colors duration-300 ${
            held ? 'rounded-full bg-black/50 backdrop-blur-sm' : ''
          }`}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="pointer-events-none absolute inset-0"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={3} />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 120ms linear' }}
            />
          </svg>
          <span className="relative flex h-6 w-6 items-center justify-center rounded border-2 border-white bg-slate-700 text-sm font-black text-white">
            E
          </span>
        </span>
        {!held && <span className="font-black text-white">{label}</span>}
      </div>
    </div>
  )
}
