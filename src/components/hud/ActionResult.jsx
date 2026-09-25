// Bottom-center popup that surfaces the result of an action attempt —
// success (green) or failure (red, with the reason). Driven imperatively via
// `show(text, success)`, polled from systems/actionResult.js's
// showActionResult() singleton at Hud.jsx's usual ~10Hz cadence — never a
// per-frame re-render. Adapted from Ice-Skate's components/hud/ActionResult.jsx
// (which anchors it top-center); moved to the bottom here per request, clear
// of ReturnButton's bottom-6 slot (the two never show at once — Buy failures
// only fire while not riding a machine).
import { forwardRef, useImperativeHandle, useRef } from 'react'

// Pop in with a slight overshoot, hold, then shrink back out.
const POP_ANIMATION = 'action-result-pop 2.4s cubic-bezier(0.34,1.56,0.64,1) forwards'

const ActionResult = forwardRef(function ActionResult(_props, ref) {
  const rootRef = useRef(null)
  const barRef = useRef(null)
  const textRef = useRef(null)

  useImperativeHandle(
    ref,
    () => ({
      show(text, success = true) {
        const root = rootRef.current
        const bar = barRef.current
        const label = textRef.current
        if (!root || !bar || !label) return
        label.textContent = text
        label.style.color = success ? '#4ade80' : '#f87171'
        root.style.display = ''
        bar.style.animation = 'none'
        void bar.offsetHeight
        bar.style.animation = POP_ANIMATION
      },
    }),
    [],
  )

  return (
    <div
      ref={rootRef}
      data-hud="action-result"
      className="pointer-events-none absolute left-1/2 bottom-16 flex -translate-x-1/2 flex-col items-center gap-1"
      style={{ display: 'none', zIndex: 60 }}
    >
      <div
        ref={barRef}
        className="relative flex h-14 w-[32rem] items-center justify-center"
        onAnimationEnd={() => {
          if (rootRef.current) rootRef.current.style.display = 'none'
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
          }}
        />
        <span
          ref={textRef}
          className="relative text-3xl font-black"
          style={{ WebkitTextStroke: '1.5px black', paintOrder: 'stroke fill' }}
        />
      </div>

      <style>{`
        @keyframes action-result-pop {
          0% { opacity: 0; transform: scale(0.4); }
          8% { opacity: 1; transform: scale(1.12); }
          14% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.5); }
        }
      `}</style>
    </div>
  )
})

export default ActionResult
