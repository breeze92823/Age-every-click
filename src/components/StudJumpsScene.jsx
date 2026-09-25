import { useEffect, useMemo } from 'react'
import { CanvasTexture, Color, MeshStandardMaterial, NearestFilter, SphereGeometry, SRGBColorSpace } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y } from '../data/world.js'
import { START_RECT, STEPS, BLOCK_BOTTOM, EXIT_PAD, CHEAP_SIGN } from '../data/studJumpsScene.js'
import { makeStudTexture, shade } from '../systems/studTexture.js'
import { makeLabelTexture } from '../systems/canvasTextures.js'

// The Stud Jumps obby: a lavender stud-plated start platform and a rainbow
// staircase of solid blocks, each labelled with how many studs it rises.
// Layout lives in data/studJumpsScene.js; walls, checkpoints and rewards in
// systems/studJumps.js.

const STUDS_PER_METRE = 0.45

function hsl(h, s, l) {
  return `#${new Color().setHSL(h, s, l).getHexString()}`
}

function boxFaces(top, side) {
  return [side, side, top, side, side, side]
}

function makeCheckerTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 8
  const g = canvas.getContext('2d')
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#1b1b1f' : '#ffffff'
      g.fillRect(x, y, 1, 1)
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.magFilter = NearestFilter
  tex.colorSpace = SRGBColorSpace
  return tex
}

function buildAssets() {
  const disposables = []
  const keep = (x) => (disposables.push(x), x)

  const block = (rect, light, sideColor) => {
    const [x0, z0, x1, z1] = rect
    const map = keep(
      makeStudTexture({
        light,
        dark: shade(light, -0.05),
        repeatX: (x1 - x0) * STUDS_PER_METRE,
        repeatY: (z1 - z0) * STUDS_PER_METRE,
      }),
    )
    const top = keep(new MeshStandardMaterial({ map, ...MATERIAL_PBR.ISLAND_TOP }))
    const side = keep(new MeshStandardMaterial({ color: sideColor, ...MATERIAL_PBR.ISLAND_SIDE }))
    return boxFaces(top, side)
  }

  const start = block(START_RECT, '#d6d2ec', '#a8a2cf')
  const steps = STEPS.map((s) => block(s.rect, hsl(s.hue, 0.8, 0.52), hsl(s.hue, 0.75, 0.38)))

  const cloudGeometry = keep(new SphereGeometry(1, 16, 12))
  const cloudMaterial = keep(
    new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 }),
  )
  const checker = keep(makeCheckerTexture())

  return { disposables, start, steps, cloudGeometry, cloudMaterial, checker }
}

function Label({ text, color, position, height = 0.6 }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color }), [text, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

// Text painted flat on a step's top, reading toward -Z (the climb direction).
function FloorText({ text, position, height = 0.5 }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color: '#ffffff' }), [text])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

function Block({ rect: [x0, z0, x1, z1], top, material }) {
  const h = top - BLOCK_BOTTOM
  return (
    <mesh position={[(x0 + x1) / 2, BLOCK_BOTTOM + h / 2, (z0 + z1) / 2]} material={material} castShadow receiveShadow>
      <boxGeometry args={[x1 - x0, h, z1 - z0]} />
    </mesh>
  )
}

function CheckpointFlag({ step, checker }) {
  return (
    <group position={[step.flag.x, step.top, step.flag.z]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 8]} />
        <meshStandardMaterial color="#d9dce2" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[-0.36, 1.5, 0]}>
        <planeGeometry args={[0.7, 0.5]} />
        <meshStandardMaterial map={checker} side={2} {...MATERIAL_PBR.PROP} />
      </mesh>
      <Label text={`+🪙${step.reward}`} color="#ffd23d" position={[-0.4, 2.25, 0]} height={0.45} />
    </group>
  )
}

function CheapSign() {
  const { x, z } = CHEAP_SIGN
  return (
    <group position={[x, GROUND_Y, z]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[1.6, 0.1, 1.2]} />
        <meshStandardMaterial color="#eef0f4" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color="#f2f4f7" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[0.8, 0.6, 0.08]} />
        <meshStandardMaterial color="#ffffff" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[0, 1.25, 0.045]}>
        <planeGeometry args={[0.55, 0.38]} />
        <meshStandardMaterial color="#2fb84b" {...MATERIAL_PBR.PROP} />
      </mesh>
      <Label text="[CHEAP]" color="#ffae2b" position={[0, 1.95, 0]} height={0.4} />
    </group>
  )
}

function ExitPad() {
  const { x, z, size } = EXIT_PAD
  return (
    <group position={[x, GROUND_Y, z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[size + 0.2, 0.08, size + 0.2]} />
        <meshStandardMaterial color="#ffffff" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[size, 0.08, size]} />
        <meshStandardMaterial color="#ffd23d" {...MATERIAL_PBR.PROP} />
      </mesh>
      <Label text="EXIT" color="#ffd23d" position={[0, 1.6, 0]} height={0.5} />
    </group>
  )
}

// Soft white puff clusters drifting below and around the platform.
const CLOUDS = [
  [-22, -9, -10, 4],
  [-30, -4, -40, 5],
  [20, -11, 12, 5],
  [26, -6, -30, 4],
  [-14, -14, 18, 6],
  [8, -16, -55, 7],
  [-40, 2, -70, 6],
  [40, 4, -60, 6],
  [0, -12, 30, 6],
]
const PUFFS = [
  [0, 0, 0, 1],
  [1.1, -0.15, 0.2, 0.8],
  [-1.1, -0.2, -0.1, 0.75],
  [0.4, 0.45, -0.3, 0.7],
  [-0.5, 0.3, 0.4, 0.65],
]

function Clouds({ geometry, material }) {
  return CLOUDS.map(([cx, cy, cz, s], i) => (
    <group key={i} position={[cx, GROUND_Y + cy, cz]} scale={s}>
      {PUFFS.map(([x, y, z, r], j) => (
        <mesh key={j} geometry={geometry} material={material} position={[x, y, z]} scale={[r, r * 0.7, r]} />
      ))}
    </group>
  ))
}

export default function StudJumpsScene() {
  const assets = useMemo(buildAssets, [])
  // three.js does not GC GPU memory.
  useEffect(() => () => assets.disposables.forEach((d) => d.dispose()), [assets])

  return (
    <group>
      <Block rect={START_RECT} top={GROUND_Y} material={assets.start} />
      {STEPS.map((s, i) => {
        const [x0, , x1, z1] = s.rect
        return (
          <group key={s.studs}>
            <Block rect={s.rect} top={s.top} material={assets.steps[i]} />
            <FloorText text={`${s.studs} Studs`} position={[(x0 + x1) / 2, s.top + 0.01, z1 - 0.5]} />
            {s.reward > 0 && <CheckpointFlag step={s} checker={assets.checker} />}
          </group>
        )
      })}
      <CheapSign />
      <ExitPad />
      <Clouds geometry={assets.cloudGeometry} material={assets.cloudMaterial} />
    </group>
  )
}
