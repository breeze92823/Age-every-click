import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y } from '../data/world.js'
import {
  START_RECT,
  END_RECT,
  FINISH_RECT,
  PLATFORM_THICKNESS,
  TILE_SIZE,
  TILE_THICKNESS,
  BRIDGE_RECT,
  EXIT_PAD,
  FINISH_PAD,
  REWARD_COINS,
} from '../data/bonusBridge.js'
import { makeStudTexture } from '../systems/studTexture.js'
import { makeLabelTexture } from '../systems/canvasTextures.js'
import { tiles } from '../systems/bonusBridge.js'

// The glass-bridge obby on the other side of the Impossible Bridge pad.
// Layout lives in data/bonusBridge.js; which tiles are safe/broken/falling
// lives in systems/bonusBridge.js and is copied onto the meshes each frame.

const STUDS_PER_METRE = 0.45
const WOOD = '#9c6232'
const WOOD_DARK = '#6e4221'
const GLASS = '#cdeff8'

function studMaterial(light, dark, w, d) {
  const map = makeStudTexture({ light, dark, repeatX: w * STUDS_PER_METRE, repeatY: d * STUDS_PER_METRE })
  return new MeshStandardMaterial({ map, ...MATERIAL_PBR.ISLAND_TOP })
}

// BoxGeometry face order: +x, -x, +y, -y, +z, -z — only +y gets the top.
function boxFaces(top, side) {
  return [side, side, top, side, side, side]
}

// Square tile-top icon (arrow or X) over a translucent coloured plate. The
// canvas's top edge maps to -Z on a box's +Y face, so "up" points down the
// bridge toward the finish.
function makeIconTexture(fill, ink, draw) {
  const s = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const g = canvas.getContext('2d')
  g.fillStyle = fill
  g.fillRect(0, 0, s, s)
  g.lineWidth = 10
  g.strokeStyle = 'rgba(255,255,255,0.55)'
  g.strokeRect(5, 5, s - 10, s - 10)
  g.fillStyle = ink
  g.strokeStyle = ink
  g.lineCap = 'round'
  g.lineJoin = 'round'
  draw(g, s)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function drawArrow(g, s) {
  g.beginPath()
  g.moveTo(s * 0.5, s * 0.14)
  g.lineTo(s * 0.8, s * 0.46)
  g.lineTo(s * 0.62, s * 0.46)
  g.lineTo(s * 0.62, s * 0.86)
  g.lineTo(s * 0.38, s * 0.86)
  g.lineTo(s * 0.38, s * 0.46)
  g.lineTo(s * 0.2, s * 0.46)
  g.closePath()
  g.fill()
}

function drawCross(g, s) {
  g.lineWidth = s * 0.16
  g.beginPath()
  g.moveTo(s * 0.22, s * 0.22)
  g.lineTo(s * 0.78, s * 0.78)
  g.moveTo(s * 0.78, s * 0.22)
  g.lineTo(s * 0.22, s * 0.78)
  g.stroke()
}

function buildAssets() {
  const disposables = []
  const keep = (x) => (disposables.push(x), x)

  const [sx0, sz0, sx1, sz1] = START_RECT
  const [ex0, ez0, ex1, ez1] = END_RECT
  const grassSide = keep(new MeshStandardMaterial({ color: '#58c232', ...MATERIAL_PBR.ISLAND_SIDE }))
  const startTop = keep(studMaterial('#7fe34c', '#77da45', sx1 - sx0, sz1 - sz0))
  const endTop = keep(studMaterial('#7fe34c', '#77da45', ex1 - ex0, ez1 - ez0))
  keep(startTop.map)
  keep(endTop.map)

  const glassTop = keep(studMaterial('#ff3fe0', '#f736d7', TILE_SIZE, TILE_SIZE))
  const glassSide = keep(new MeshStandardMaterial({ color: '#d61fb8', ...MATERIAL_PBR.PROP }))
  const safeTop = keep(studMaterial('#6fe36b', '#66d962', TILE_SIZE, TILE_SIZE))
  const safeSide = keep(new MeshStandardMaterial({ color: '#3fb03f', ...MATERIAL_PBR.PROP }))
  keep(glassTop.map)
  keep(safeTop.map)

  const translucent = { transparent: true, opacity: 0.8, ...MATERIAL_PBR.GLASS }
  const arrowMap = keep(makeIconTexture('#8ff0a0', '#1f9e3c', drawArrow))
  const crossMap = keep(makeIconTexture('#ff5a5a', '#b3121b', drawCross))
  const arrowTop = keep(new MeshStandardMaterial({ map: arrowMap, ...translucent }))
  const arrowSide = keep(new MeshStandardMaterial({ color: '#4cc766', ...translucent }))
  const crossTop = keep(new MeshStandardMaterial({ map: crossMap, ...translucent }))
  const crossSide = keep(new MeshStandardMaterial({ color: '#d93434', ...translucent }))

  const tileGeometry = keep(new BoxGeometry(TILE_SIZE, TILE_THICKNESS, TILE_SIZE))

  return {
    disposables,
    start: { rect: START_RECT, material: boxFaces(startTop, grassSide) },
    end: { rect: END_RECT, material: boxFaces(endTop, grassSide) },
    tileGeometry,
    tileMaterials: {
      glass: boxFaces(glassTop, glassSide),
      revealed: boxFaces(safeTop, safeSide),
      arrow: boxFaces(arrowTop, arrowSide),
      cross: boxFaces(crossTop, crossSide),
    },
  }
}

function Label({ text, color, position, height = 0.8 }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color }), [text, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

function Platform({ rect: [x0, z0, x1, z1], material }) {
  return (
    <mesh
      position={[(x0 + x1) / 2, GROUND_Y - PLATFORM_THICKNESS / 2, (z0 + z1) / 2]}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[x1 - x0, PLATFORM_THICKNESS, z1 - z0]} />
    </mesh>
  )
}

function Beam({ size, position, color = GLASS, opacity = 0.7 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent opacity={opacity} {...MATERIAL_PBR.GLASS} />
    </mesh>
  )
}

// Thin translucent frame the tiles sit in: a rail down each side and the
// middle, closed off at both platform edges.
function GlassFrame() {
  const [x0, z0, x1, z1] = BRIDGE_RECT
  const len = z1 - z0
  const cz = (z0 + z1) / 2
  const y = GROUND_Y - TILE_THICKNESS - 0.08
  const t = 0.14
  return (
    <group>
      {[x0, 0, x1].map((x) => (
        <Beam key={x} size={[t, t, len]} position={[x, y, cz]} />
      ))}
      {[z0, z1].map((z) => (
        <Beam key={z} size={[x1 - x0 + t, t, t]} position={[0, y, z]} />
      ))}
      <Beam size={[x1 - x0, 0.02, len]} position={[0, y - 0.06, cz]} opacity={0.18} />
    </group>
  )
}

function Tiles({ assets }) {
  const meshes = useRef([])
  useFrame(() => {
    for (let i = 0; i < tiles.length; i++) {
      const mesh = meshes.current[i]
      if (!mesh) continue
      const t = tiles[i]
      mesh.visible = t.fall < 30
      mesh.position.y = GROUND_Y - TILE_THICKNESS / 2 - t.fall
      mesh.rotation.x = t.fall * 0.08
      mesh.rotation.z = t.fall * (t.lane === 0 ? -0.05 : 0.05)
      const kind = t.kind === 'glass' && t.revealed ? 'revealed' : t.kind
      mesh.material = assets.tileMaterials[kind]
    }
  })
  return tiles.map((t, i) => (
    <mesh
      key={i}
      ref={(m) => (meshes.current[i] = m)}
      geometry={assets.tileGeometry}
      material={assets.tileMaterials[t.kind]}
      position={[t.x, GROUND_Y - TILE_THICKNESS / 2, t.z]}
      castShadow
      receiveShadow
    />
  ))
}

function ExitPad() {
  const { x, z, size } = EXIT_PAD
  return (
    <group position={[x, GROUND_Y, z]}>
      <Beam size={[size + 0.2, 0.08, size + 0.2]} position={[0, 0.04, 0]} color="#ffffff" opacity={1} />
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[size, 0.08, size]} />
        <meshStandardMaterial color="#ffd23d" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[-size / 2 - 0.2, 0.9, -size / 2 - 0.2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 8]} />
        <meshStandardMaterial color="#8a8f99" {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh position={[-size / 2 + 0.2, 1.5, -size / 2 - 0.2]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.04]} />
        <meshStandardMaterial color="#f2f4f7" {...MATERIAL_PBR.PROP} />
      </mesh>
      <Label text={`+🪙${REWARD_COINS}`} color="#ffd23d" position={[0.2, 2.4, -0.6]} height={0.6} />
    </group>
  )
}

// Yellow pad on the finish platform — stepping onto it sends the player
// back to the island (no payout; EXIT_PAD is the one that pays out).
function FinishPad() {
  const { x, z, size } = FINISH_PAD
  return (
    <group position={[x, GROUND_Y, z]}>
      <Beam size={[size + 0.2, 0.08, size + 0.2]} position={[0, 0.04, 0]} color="#ffffff" opacity={1} />
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[size, 0.08, size]} />
        <meshStandardMaterial color="#ffd23d" {...MATERIAL_PBR.PROP} />
      </mesh>
    </group>
  )
}

// Wooden rail fence along the finish platform's back and both sides; the
// bridge-facing edge stays open.
function Fence() {
  const [x0, z0, x1, z1] = FINISH_RECT
  const inset = 0.25
  const spacing = 1.6
  // z1 is the bridge-facing (entrance) edge, z0 the back — fence the back
  // and both sides, leave the entrance open.
  const runs = [
    { from: [x0 + inset, z0 + inset], to: [x1 - inset, z0 + inset] },
    { from: [x0 + inset, z0 + inset], to: [x0 + inset, z1 - inset] },
    { from: [x1 - inset, z0 + inset], to: [x1 - inset, z1 - inset] },
  ]
  return (
    <group position-y={GROUND_Y}>
      {runs.map(({ from: [ax, az], to: [bx, bz] }, r) => {
        const len = Math.hypot(bx - ax, bz - az)
        const alongX = bz === az
        const count = Math.round(len / spacing)
        const posts = Array.from({ length: count + 1 }, (_, i) => [ax + ((bx - ax) * i) / count, az + ((bz - az) * i) / count])
        return (
          <group key={r}>
            {posts.map(([px, pz], i) => (
              <mesh key={i} position={[px, 0.6, pz]} castShadow>
                <boxGeometry args={[0.22, 1.2, 0.22]} />
                <meshStandardMaterial color={WOOD_DARK} {...MATERIAL_PBR.DECOR} />
              </mesh>
            ))}
            {[0.45, 0.9].map((y) => (
              <mesh key={y} position={[(ax + bx) / 2, y, (az + bz) / 2]} castShadow>
                <boxGeometry args={alongX ? [len, 0.12, 0.1] : [0.1, 0.12, len]} />
                <meshStandardMaterial color={WOOD} {...MATERIAL_PBR.DECOR} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function FinishSign() {
  return (
    <group position={[3, GROUND_Y, FINISH_RECT[3] - 2.5]} rotation-y={-0.3}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.14, 1, 0.14]} />
        <meshStandardMaterial color={WOOD_DARK} {...MATERIAL_PBR.DECOR} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[1.3, 0.7, 0.12]} />
        <meshStandardMaterial color={WOOD} {...MATERIAL_PBR.DECOR} />
      </mesh>
    </group>
  )
}

export default function BonusScene() {
  const assets = useMemo(buildAssets, [])
  // three.js does not GC GPU memory.
  useEffect(() => () => assets.disposables.forEach((d) => d.dispose()), [assets])

  return (
    <group>
      <Platform {...assets.start} />
      <Platform {...assets.end} />
      <GlassFrame />
      <Tiles assets={assets} />
      <ExitPad />
      <FinishPad />
      <Fence />
      <FinishSign />
    </group>
  )
}
