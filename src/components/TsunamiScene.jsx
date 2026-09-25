import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CanvasTexture,
  DoubleSide,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y } from '../data/world.js'
import {
  WALL_HEIGHT,
  BASE_BOTTOM,
  OUTER_RECT,
  PIT_RECT,
  SLABS,
  END_RECT,
  VIP_SIGNS_Z,
  CHEAP_SIGN,
  EXIT_PAD,
  REWARD_PAD,
  REWARD_COINS,
  WAVE,
  WAVE_TYPES,
} from '../data/tsunamiScene.js'
import { makeStudTexture, shade } from '../systems/studTexture.js'
import { makeLabelTexture } from '../systems/canvasTextures.js'
import { waves } from '../systems/tsunamiScene.js'

// The Tsunami Escape trench: brick walls under a grass rim, raised safe
// slabs spanning its full width (one yellow MEDIUM), VIP boards on the right
// wall and a reward pad at the far end. Layout lives in data/tsunamiScene.js; collision and
// the reward in systems/tsunamiScene.js.

const STUDS_PER_METRE = 0.45
const BRICK_TILE_W = 2 // metres covered by one brick bitmap, horizontally
const BRICK_TILE_H = 1
const GRASS = '#86e03a'
const GRASS_DARK = '#7dd634'
const GRASS_SIDE = '#5fb82a'
const YELLOW = '#ffe21a'
const YELLOW_DARK = '#f7d80f'
const YELLOW_SIDE = '#d9b800'

function makeBrickCanvas() {
  const w = 256
  const h = 128
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  g.fillStyle = '#94473a'
  g.fillRect(0, 0, w, h)
  const rows = 8
  const perRow = 4
  const bh = h / rows
  const bw = w / perRow
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? bw / 2 : 0
    for (let c = -1; c <= perRow; c++) {
      const x = c * bw + offset
      const y = r * bh
      // Small per-brick tint variation so the wall doesn't read as flat paint.
      const tint = ((r * 7 + c * 13) % 5) * 0.02 - 0.04
      g.fillStyle = shade('#b35c48', tint)
      g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3)
    }
  }
  return canvas
}

function buildAssets() {
  const disposables = []
  const keep = (x) => (disposables.push(x), x)
  const brickCanvas = makeBrickCanvas()

  const brick = (u, v, tint = 0) => {
    const map = keep(new CanvasTexture(brickCanvas))
    map.wrapS = map.wrapT = RepeatWrapping
    map.repeat.set(u / BRICK_TILE_W, v / BRICK_TILE_H)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 4
    return keep(new MeshStandardMaterial({ map, color: shade('#ffffff', tint), ...MATERIAL_PBR.ISLAND_SIDE }))
  }
  const stud = (light, dark, w, d) => {
    const map = keep(makeStudTexture({ light, dark, repeatX: w * STUDS_PER_METRE, repeatY: d * STUDS_PER_METRE }))
    return keep(new MeshStandardMaterial({ map, ...MATERIAL_PBR.ISLAND_TOP }))
  }
  const plain = (color) => keep(new MeshStandardMaterial({ color, ...MATERIAL_PBR.ISLAND_SIDE }))

  // BoxGeometry face order: +x, -x, +y, -y, +z, -z. The ±x faces span depth
  // by height, the ±z faces width by height.
  const block = ([x0, z0, x1, z1], bottom, top, topMaterial, side) => {
    const w = x1 - x0
    const d = z1 - z0
    const h = top - bottom
    const sideX = side ?? brick(d, h)
    const sideZ = side ?? brick(w, h)
    return {
      position: [(x0 + x1) / 2, bottom + h / 2, (z0 + z1) / 2],
      size: [w, h, d],
      material: [sideX, sideX, topMaterial, sideX, sideZ, sideZ],
    }
  }

  const [ox0, oz0, ox1, oz1] = OUTER_RECT
  const [px0, pz0, px1, pz1] = PIT_RECT
  const rimTop = GROUND_Y + WALL_HEIGHT
  const rims = [
    [ox0, oz0, px0, oz1],
    [px1, oz0, ox1, oz1],
    [px0, pz1, px1, oz1],
    [px0, oz0, px1, pz0],
  ].map((r) => block(r, BASE_BOTTOM, rimTop, stud(GRASS, GRASS_DARK, r[2] - r[0], r[3] - r[1])))

  const floor = block(PIT_RECT, BASE_BOTTOM, GROUND_Y, brick(px1 - px0, pz1 - pz0, -0.15))

  const slabs = SLABS.map((s) => {
    const [x0, z0, x1, z1] = s.rect
    const yellow = s.color === 'yellow'
    const top = yellow ? stud(YELLOW, YELLOW_DARK, x1 - x0, z1 - z0) : stud(GRASS, GRASS_DARK, x1 - x0, z1 - z0)
    return block(s.rect, GROUND_Y - 0.01, s.top, top, plain(yellow ? YELLOW_SIDE : GRASS_SIDE))
  })

  const endStrip = stud(GRASS, GRASS_DARK, END_RECT[2] - END_RECT[0], END_RECT[3] - END_RECT[1])

  // A sheet spanning the pit whose top curls forward (+Z, the travel
  // direction) and whose side edges flare forward, like a breaking wave.
  const waveW = px1 - px0 - 0.1
  const waveGeometry = keep(new PlaneGeometry(waveW, WAVE.height, 32, 16))
  const pos = waveGeometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (waveW / 2)
    const v = pos.getY(i) / WAVE.height + 0.5
    pos.setY(i, v * WAVE.height)
    pos.setZ(i, 1.4 * v * v + 1.6 * u ** 4)
  }
  waveGeometry.computeVertexNormals()
  const waveMaterials = WAVE_TYPES.map(({ color, emissive }) =>
    keep(new MeshStandardMaterial({ color, emissive, side: DoubleSide, ...MATERIAL_PBR.ISLAND_TOP })),
  )

  const cloudGeometry = keep(new SphereGeometry(1, 16, 12))
  const cloudMaterial = keep(
    new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 }),
  )

  return { disposables, rims, floor, slabs, endStrip, waveGeometry, waveMaterials, cloudGeometry, cloudMaterial }
}

// One pooled wave slot: every type is built once, and each frame only the
// slot's current type is shown (or none, while the slot is idle).
function Wave({ slot, geometry, materials }) {
  const group = useRef()
  const variants = useRef([])
  useFrame(() => {
    if (!group.current) return
    group.current.visible = slot.active
    group.current.position.z = slot.z
    variants.current.forEach((v, i) => v && (v.visible = i === slot.type))
  })
  return (
    <group ref={group} position={[(PIT_RECT[0] + PIT_RECT[2]) / 2, WAVE.bottom, slot.z]} visible={false}>
      {WAVE_TYPES.map((t, i) => (
        <group key={t.label} ref={(g) => (variants.current[i] = g)}>
          <mesh geometry={geometry} material={materials[i]} castShadow />
          <Label text={t.label} color="#ffffff" position={[0, WAVE.height + 0.9, 1]} height={0.8} />
        </group>
      ))}
    </group>
  )
}

function Block({ position, size, material, castShadow = true }) {
  return (
    <mesh position={position} material={material} castShadow={castShadow} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

function FloorPlane({ rect: [x0, z0, x1, z1], y, material }) {
  return (
    <mesh position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} material={material} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
    </mesh>
  )
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

function FlatText({ text, color, position, height }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color }), [text, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

// Dark board with a pink crown badge, hung on the inside of the +X wall.
function VipSign({ z }) {
  return (
    <group position={[PIT_RECT[2] - 0.06, GROUND_Y + 2.2, z]} rotation-y={-Math.PI / 2}>
      <mesh castShadow>
        <boxGeometry args={[1.3, 1.7, 0.1]} />
        <meshStandardMaterial color="#2c2233" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[0, 0.15, 0.06]}>
        <circleGeometry args={[0.45, 32]} />
        <meshStandardMaterial color="#e8457a" {...MATERIAL_PBR.PROP} />
      </mesh>
      <FlatText text="👑" color="#ffd23d" position={[0, 0.38, 0.07]} height={0.3} />
      <FlatText text="VIP" color="#ffffff" position={[0, 0.08, 0.07]} height={0.32} />
      <FlatText text="ONLY" color="#ffd23d" position={[0, -0.55, 0.07]} height={0.22} />
    </group>
  )
}

function CheapSign() {
  const { x, z } = CHEAP_SIGN
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={-0.4}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[1.4, 0.1, 1.1]} />
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

function Pad({ x, z, size, color, children }) {
  return (
    <group position={[x, GROUND_Y, z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[size + 0.2, 0.08, size + 0.2]} />
        <meshStandardMaterial color="#ffffff" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[size, 0.08, size]} />
        <meshStandardMaterial color={color} {...MATERIAL_PBR.PROP} />
      </mesh>
      {children}
    </group>
  )
}

const CLOUDS = [
  [-26, -6, -10, 5],
  [26, -8, -20, 5],
  [-24, -10, -50, 6],
  [28, -4, -60, 5],
  [0, -12, 20, 6],
  [-6, 6, -95, 8],
  [20, 8, -90, 7],
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

export default function TsunamiScene() {
  const assets = useMemo(buildAssets, [])
  // three.js does not GC GPU memory.
  useEffect(() => () => assets.disposables.forEach((d) => d.dispose()), [assets])

  return (
    <group>
      {assets.rims.map((b, i) => (
        <Block key={i} {...b} />
      ))}
      <Block {...assets.floor} castShadow={false} />
      {assets.slabs.map((b, i) => (
        <Block key={i} {...b} />
      ))}
      {waves.map((slot, i) => (
        <Wave key={i} slot={slot} geometry={assets.waveGeometry} materials={assets.waveMaterials} />
      ))}
      <FloorPlane rect={END_RECT} y={GROUND_Y + 0.02} material={assets.endStrip} />
      {VIP_SIGNS_Z.map((z) => (
        <VipSign key={z} z={z} />
      ))}
      <CheapSign />
      <Pad {...EXIT_PAD} color="#ffd23d">
        <Label text="EXIT" color="#ffd23d" position={[0, 1.6, 0]} height={0.5} />
      </Pad>
      <Pad {...REWARD_PAD} color="#ffd23d">
        <Label text={`+🪙${REWARD_COINS}`} color="#ffd23d" position={[0, 1.8, 0]} height={0.7} />
      </Pad>
      <Clouds geometry={assets.cloudGeometry} material={assets.cloudMaterial} />
    </group>
  )
}
