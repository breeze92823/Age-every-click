import { useEffect, useState } from 'react'
import { useTutorialSpotlight } from '../../systems/tutorialSpotlight.js'

// Sits above every other HUD element (z-40, over InteractPrompt/ReturnButton's
// z-30) so the dim tint reads as "everything except the target". The hole is
// a transparent box the exact size of the target element with a huge
// box-shadow spread painting the dark tint everywhere outside it — the
// classic spotlight trick, so the real button underneath just shows through
// undimmed rather than needing a z-index fight or a cloned/portaled button.
const ARROW_SIZE = 72
const ARROW_GAP = 14 // px between the target's edge and the arrow

export default function TutorialSpotlight() {
  const target = useTutorialSpotlight((s) => s.target)
  const rotation = useTutorialSpotlight((s) => s.rotation)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!target) {
      setRect(null)
      return
    }
    const measure = () => {
      const el = document.querySelector(`[data-tutorial-target="${target}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [target])

  if (!target || !rect) return null

  return (
    <>
      <div
        className="pointer-events-none fixed z-40 rounded-xl"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
        }}
      />
      {/* Outer div holds the fixed placement + rotation (static); the inner
         img bounces along its own local axis, so the bounce direction turns
         along with the arrow instead of always being a plain vertical hop. */}
      <div
        className="pointer-events-none fixed z-40"
        style={{
          left: rect.left + rect.width + ARROW_GAP,
          top: rect.top + rect.height / 2,
          transform: `translateY(-50%) rotate(${rotation}deg)`,
          transformOrigin: 'center',
        }}
      >
        <img
          src="/ui/action_popup.png"
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: ARROW_SIZE,
            height: ARROW_SIZE,
            animation: 'tutorial-arrow-bounce 0.9s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes tutorial-arrow-bounce {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-12px, -12px); }
        }
      `}</style>
    </>
  )
}
