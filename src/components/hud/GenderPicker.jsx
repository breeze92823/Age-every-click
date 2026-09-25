import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { useGameStore } from '../../store/useGameStore.js'
import { buildDefaultCharacter } from '../../systems/defaultCharacter.js'
import { playButtonClick, playButtonHover } from '../../systems/sfx.js'

// Shown at the start of every session (the store's gender starts null and is
// never saved) over a blurred game. Choosing a card sets the store's gender,
// which un-freezes the player (systems/playerMovement.js) and dresses the
// character (Player.jsx). The X skips the choice and keeps the boy.
//
// The portraits are the game's own character, rendered once each into a
// throwaway WebGL context so they always match what the player will see.

const OUTLINE = { WebkitTextStroke: '0.06em black', paintOrder: 'stroke fill' }
const PORTRAIT_PX = 320

function renderPortraits() {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(PORTRAIT_PX, PORTRAIT_PX, false)
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  const scene = new Scene()
  scene.add(new HemisphereLight('#dce8f2', '#a89a80', 1.3))
  const sun = new DirectionalLight('#ffffff', 2)
  sun.position.set(2, 4, 5)
  scene.add(sun)

  // Head and torso, like the reference art: the character is 1.8 m tall.
  const camera = new OrthographicCamera(-0.9, 0.9, 0.9, -0.9, 0.1, 20)
  camera.position.set(0, 1.2, 6)
  camera.lookAt(0, 1.2, 0)

  const out = {}
  for (const gender of ['boy', 'girl']) {
    const character = buildDefaultCharacter('striped', gender)
    character.rotation.y = gender === 'boy' ? 0.25 : -0.25
    scene.add(character)
    renderer.render(scene, camera)
    out[gender] = renderer.domElement.toDataURL('image/png')
    scene.remove(character)
  }
  renderer.dispose()
  renderer.forceContextLoss()
  return out
}

function Card({ label, image, from, to, ring, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={playButtonHover}
      className="group flex flex-1 flex-col items-center gap-0 focus:outline-none"
    >
      <div
        className={`relative aspect-square w-[min(78%,40dvh)] overflow-hidden rounded-full border-[3px] border-black transition group-hover:scale-105 group-focus-visible:scale-105 ${ring}`}
      >
        {image && <img src={image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      <span
        className={`-mt-[0.6em] w-[86%] rounded-lg border-[3px] border-black bg-gradient-to-b py-1 text-center text-[clamp(1.25rem,min(5vw,9dvh),3.25rem)] font-black leading-none text-white shadow-[0_4px_0_rgba(0,0,0,0.35)] transition group-hover:brightness-110 ${from} ${to}`}
        style={OUTLINE}
      >
        {label}
      </span>
    </button>
  )
}

export default function GenderPicker() {
  const gender = useGameStore((s) => s.gender)
  const setGender = useGameStore((s) => s.setGender)
  const [portraits, setPortraits] = useState({})

  const needsPick = gender == null
  useEffect(() => {
    if (!needsPick) return
    try {
      setPortraits(renderPortraits())
    } catch {
      // No spare WebGL context: the cards just show without a portrait.
    }
  }, [needsPick])

  if (!needsPick) return null

  const pick = (g) => {
    playButtonClick()
    setGender(g)
  }

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 flex touch-manipulation items-center justify-center bg-black/25 backdrop-blur-md"
      style={{
        zIndex: 150,
        padding: 'max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))',
      }}
      onWheel={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Pick your gender"
    >
      <div className="relative w-[min(860px,94vw,170dvh)]">
        <span
          className="pointer-events-none absolute -left-3 -top-[0.75em] z-10 -rotate-3 text-[clamp(1.75rem,min(7vw,12dvh),4.5rem)] font-black leading-none text-white"
          style={OUTLINE}
        >
          Hello!
        </span>
        <button
          type="button"
          onClick={() => pick('boy')}
          aria-label="Close"
          className="absolute -right-3 -top-4 z-10 flex h-[clamp(2rem,7dvh,2.75rem)] w-[clamp(2rem,7dvh,2.75rem)] items-center justify-center rounded-lg border-[3px] border-black bg-red-600 text-xl font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.4)] transition hover:bg-red-500"
        >
          ✕
        </button>

        <div className="overflow-hidden rounded-2xl border-[3px] border-black bg-slate-700/90 p-2 shadow-2xl">
          <div className="rounded-xl border-2 border-black/40 bg-gradient-to-r from-sky-400 from-40% to-pink-300 to-60% px-3 pb-[clamp(0.5rem,3dvh,1.25rem)] pt-[clamp(0.25rem,1.5dvh,0.75rem)] sm:px-6">
            <h2
              className="text-center text-[clamp(1.25rem,min(4.4vw,8dvh),3rem)] font-black leading-tight text-white"
              style={OUTLINE}
            >
              Pick your gender!
            </h2>
            <div className="mt-2 flex items-start justify-center gap-3 sm:gap-6">
              <Card
                label="Boy"
                image={portraits.boy}
                from="from-sky-400"
                to="to-sky-500"
                ring="bg-sky-400"
                onPick={() => pick('boy')}
              />
              <Card
                label="Girl"
                image={portraits.girl}
                from="from-pink-300"
                to="to-pink-400"
                ring="bg-pink-300"
                onPick={() => pick('girl')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
