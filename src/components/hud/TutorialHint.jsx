import { useEffect, useRef } from 'react'
import { useTutorialHint } from '../../systems/tutorialHints.js'
import { useTouchMode } from './hooks.js'

// Bottom-center tutorial tip text — plain white text (one substring can be
// highlighted yellow, e.g. "Coins!", "Basic Age Machine", "Rebirth"), no
// backing pill, so it reads as a caption rather than another HUD button.
// Sits between ReturnButton (bottom-6) and InteractPrompt (bottom-28) so it
// doesn't collide with either when they happen to show at the same time.
// Pops in with a bounce whenever the hint changes, then keeps a slow glowing
// pulse going the whole time it's shown so it doesn't get lost as background
// text while the player is looking at the 3D scene.
const POP_ANIMATION = 'tutorial-hint-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both'
const PULSE_ANIMATION = 'tutorial-hint-pulse 1.6s ease-in-out 0.5s infinite'

export default function TutorialHint() {
  const text = useTutorialHint((s) => s.text)
  const highlight = useTutorialHint((s) => s.highlight)
  const isTouch = useTouchMode()
  const spanRef = useRef(null)

  useEffect(() => {
    const el = spanRef.current
    if (!el || !text) return
    // Restart the animation from scratch on every new hint (re-triggering a
    // running CSS animation needs a reflow in between the reset and reapply).
    el.style.animation = 'none'
    void el.offsetHeight
    el.style.animation = `${POP_ANIMATION}, ${PULSE_ANIMATION}`
  }, [text, highlight])

  if (!text) return null

  const split = highlight ? splitOnHighlight(text, highlight) : null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: isTouch ? 'calc(env(safe-area-inset-bottom, 0px) + 75px)' : '75px' }}
    >
      <span
        ref={spanRef}
        className={`inline-block text-center font-black text-white ${isTouch ? 'text-xl' : 'text-[2rem] sm:text-4xl'}`}
        style={{ WebkitTextStroke: isTouch ? '1.5px black' : '2px black', paintOrder: 'stroke fill' }}
      >
        {split ? (
          <>
            {split.before}
            <span className="text-yellow-400">{highlight}</span>
            {split.after}
          </>
        ) : (
          text
        )}
      </span>
      <style>{`
        @keyframes tutorial-hint-pop {
          0% { opacity: 0; transform: scale(0.4) translateY(24px); }
          65% { opacity: 1; transform: scale(1.18) translateY(-6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes tutorial-hint-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(250,204,21,0)); }
          50% { transform: scale(1.06); filter: drop-shadow(0 0 14px rgba(250,204,21,0.85)); }
        }
      `}</style>
    </div>
  )
}

function splitOnHighlight(text, highlight) {
  const i = text.indexOf(highlight)
  if (i === -1) return null
  return { before: text.slice(0, i), after: text.slice(i + highlight.length) }
}
