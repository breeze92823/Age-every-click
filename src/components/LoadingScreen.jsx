import { useEffect, useState } from 'react'
import { authState, subscribeAuth } from '../systems/bloxity.js'
import { DEV_MODE } from '../data/bloxity.js'

// Full-screen DOM overlay, a sibling of <Canvas> in App.jsx (never drei
// <Html>) — sits over the canvas until Bloxity auth has settled. The canvas
// still mounts underneath so the island keeps building behind this screen
// (it's all procedural geometry, nothing to await), and Player.jsx's capsule
// covers the player instantly regardless, so auth is the only real gate:
// without it the HUD's IdentityChip/AuthPanel would flash a guest state for
// one frame before the real signed-in identity (or guest identity) resolves.
//
// DEV_MODE (VITE_DEV_MODE=true) skips this outright — systems/bloxity.js
// never touches the SDK in that mode, so authState.ready flips true on the
// very first render and this screen would otherwise just be a same-frame
// flash. Rendering null instead avoids even that flash for local dev.
const FADE_MS = 450

export default function LoadingScreen() {
  const [authReady, setAuthReady] = useState(authState.ready)
  const [hidden, setHidden] = useState(false)

  useEffect(() => subscribeAuth((s) => setAuthReady(s.ready)), [])

  // Fades out FADE_MS once auth settles; reopens immediately (no fade) if it
  // somehow isn't ready yet, so a fast reload never flashes the game before
  // this screen catches up.
  useEffect(() => {
    if (!authReady) {
      setHidden(false)
      return
    }
    const id = setTimeout(() => setHidden(true), FADE_MS)
    return () => clearTimeout(id)
  }, [authReady])

  if (DEV_MODE) return null

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#0b0d12] transition-opacity ease-out"
      style={{
        zIndex: 200,
        opacity: hidden ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
      aria-hidden={hidden}
    >
      <div className="flex flex-col items-center gap-6 px-8">
        <h1
          className="select-none text-center text-2xl font-black tracking-[0.2em] text-white sm:text-3xl"
          style={{ WebkitTextStroke: '1.5px black', paintOrder: 'stroke fill' }}
        >
          AGE EVERY CLICK
        </h1>
        <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10 sm:w-80">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#ffd21e] shadow-[0_0_10px_#ffd21e]" />
        </div>
        <div className="select-none font-mono text-xs tracking-widest text-slate-400">SIGNING IN…</div>
      </div>
    </div>
  )
}
