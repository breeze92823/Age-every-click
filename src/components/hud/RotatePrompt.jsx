import { useEffect, useState } from 'react'
import { touchState, subscribeTouchMode } from '../../systems/input.js'

// Full-screen "turn your phone" gate. The two-thumb touch layout
// (TouchControls.jsx) needs the width of landscape; in portrait the stick
// and jump button crowd the middle of the scene. Shown only once the
// session is judged touch-driven — a narrow desktop window is left alone.
function isPortrait() {
  if (typeof window === 'undefined') return false
  return window.innerHeight > window.innerWidth
}

export default function RotatePrompt() {
  const [touch, setTouch] = useState(touchState.active)
  const [portrait, setPortrait] = useState(isPortrait())

  useEffect(() => subscribeTouchMode(setTouch), [])

  useEffect(() => {
    const sync = () => setPortrait(isPortrait())
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  if (!touch || !portrait) return null

  return (
    <div
      className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-5 bg-[#0b0d12] px-8 text-center text-slate-100"
      style={{ zIndex: 100, touchAction: 'none' }}
    >
      <svg
        width="88"
        height="88"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: 'rotate-hint 2.2s ease-in-out infinite' }}
      >
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 19h2" />
        <path d="M2 12a10 10 0 0 1 3-7" />
        <path d="M2 5v4h4" />
      </svg>
      <div className="text-lg font-bold tracking-wide">Rotate your device</div>
      <div className="max-w-xs text-sm leading-6 text-slate-400">
        Age Every Click plays in landscape. Turn your phone sideways to keep going.
      </div>
      <style>{`@keyframes rotate-hint{0%,55%{transform:rotate(0)}80%,100%{transform:rotate(-90deg)}}`}</style>
    </div>
  )
}
