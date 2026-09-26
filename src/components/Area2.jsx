import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshStandardMaterial, Object3D } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y, ISLAND_HEIGHT, ISLAND_SCALE } from '../data/world.js'
import {
  AREA2_CORE,
  AREA2_EDGE,
  AREA2_GRASS_RECTS,
  AREA2_PATHS,
  AREA2_GATE,
  AREA2_AGE_MACHINES,
  AFK_ZONE,
  AFK_CRATES,
  AFK_COIN_PILES,
  BRIDGE,
  BRIDGE_RAIL_X,
  BRIDGE_RAIL_INSET,
} from '../data/area2.js'
import { makeStudTexture } from '../systems/studTexture.js'
import { makeIconLabelTexture, makeLabelTexture } from '../systems/canvasTextures.js'
import { flatRect, slab, merge } from '../systems/levelGeometry.js'
import { isArea2Unlocked, afkState, afkSecondsLeft } from '../systems/area2.js'
import { useGameStore } from '../store/useGameStore.js'
import { AgeMachines, Box, Label, Mat } from './IslandLandmarks.jsx'

// Area 2 (data/area2.js): a second island east of the hub, joined by a
// wooden bridge, gated behind Rebirths, with its own Age Machine stand and
// an AFK zone. Rendered inside Island.jsx's scaled group, so everything here
// is in local (pre-ISLAND_SCALE) units, same as IslandLandmarks.jsx.

// Same ground build-up as Island.jsx's hub.
const GRASS_DEPTH = 0.35
const SAND_BOTTOM = GROUND_Y - (ISLAND_HEIGHT + 0.6) / ISLAND_SCALE
const PATH_Y = GROUND_Y + 0.02
const AFK_Y = GROUND_Y + 0.03

function buildTerrain() {
  const grassTexture = makeStudTexture({ light: '#86cf55', dark: '#6bb443', repeatX: 1, repeatY: 1 })
  const pathTexture = makeStudTexture({ light: '#ebe4d2', dark: '#ded6c1', repeatX: 1, repeatY: 1 })
  const afkTexture = makeStudTexture({ light: '#ffd84a', dark: '#f5c62e', repeatX: 1, repeatY: 1 })
  const parts = [
    {
      geometry: merge(AREA2_GRASS_RECTS.map((r) => flatRect(r, GROUND_Y))),
      material: new MeshStandardMaterial({ map: grassTexture, ...MATERIAL_PBR.ISLAND_TOP }),
    },
    {
      geometry: merge(AREA2_GRASS_RECTS.map((r) => slab(r, GROUND_Y - GRASS_DEPTH, GROUND_Y - 0.005))),
      material: new MeshStandardMaterial({ color: '#4c9a2c', ...MATERIAL_PBR.ISLAND_SIDE }),
      castShadow: true,
    },
    {
      geometry: merge([AREA2_CORE, ...AREA2_EDGE.map((c) => c.sand)].map((r) => slab(r, SAND_BOTTOM, GROUND_Y - GRASS_DEPTH))),
      material: new MeshStandardMaterial({ color: '#e8cd7a', ...MATERIAL_PBR.ISLAND_SIDE }),
    },
    {
      geometry: merge(AREA2_PATHS.map((r) => flatRect(r, PATH_Y))),
      material: new MeshStandardMaterial({ map: pathTexture, ...MATERIAL_PBR.PATH }),
    },
    {
      geometry: flatRect(AFK_ZONE.rect, AFK_Y),
      material: new MeshStandardMaterial({ map: afkTexture, emissive: '#ffb000', emissiveIntensity: 0.12, ...MATERIAL_PBR.PATH }),
    },
  ]
  return { parts, textures: [grassTexture, pathTexture, afkTexture] }
}

function Terrain() {
  const terrain = useMemo(buildTerrain, [])
  // three.js does not GC GPU memory.
  useEffect(
    () => () => {
      for (const { geometry, material } of terrain.parts) {
        geometry.dispose()
        material.dispose()
      }
      for (const t of terrain.textures) t.dispose()
    },
    [terrain],
  )
  return terrain.parts.map(({ geometry, material, castShadow = false }, i) => (
    <mesh key={i} geometry={geometry} material={material} receiveShadow castShadow={castShadow} />
  ))
}

// Chunky toy-brick bridge: cross planks on two long beams, posts and a
// double rail along each side, and pylons down into the water.
const PLANK = '#c4643c'
const PLANK_DARK = '#94462a'
const PLANK_PITCH = 1
const RAIL_H = 1

function Bridge() {
  const [x0, z0, x1, z1] = BRIDGE.rect
  const width = z1 - z0
  const cz = (z0 + z1) / 2
  const top = GROUND_Y + BRIDGE.deckHeight
  const planks = []
  for (let x = x0 + PLANK_PITCH / 2; x < x1; x += PLANK_PITCH) planks.push(x)
  const [rx0, rx1] = BRIDGE_RAIL_X
  const posts = []
  for (let x = rx0; x <= rx1 + 0.01; x += 2) posts.push(x)
  const railLen = rx1 - rx0
  const railCx = (rx0 + rx1) / 2
  const sides = [z0 + BRIDGE_RAIL_INSET, z1 - BRIDGE_RAIL_INSET]
  return (
    <group>
      {planks.map((x) => (
        <Box key={x} size={[PLANK_PITCH - 0.12, 0.14, width]} position={[x, top - 0.07, cz]} color={PLANK} />
      ))}
      {sides.map((z) => (
        <Box key={z} size={[x1 - x0, 0.2, 0.3]} position={[(x0 + x1) / 2, top - 0.22, z]} color={PLANK_DARK} />
      ))}
      {sides.map((z) => (
        <group key={z}>
          {posts.map((x) => (
            <Box key={x} size={[0.3, RAIL_H + 0.1, 0.3]} position={[x, top + (RAIL_H + 0.1) / 2, z]} color={PLANK_DARK} />
          ))}
          <Box size={[railLen, 0.18, 0.22]} position={[railCx, top + RAIL_H, z]} color={PLANK} />
          <Box size={[railLen, 0.14, 0.18]} position={[railCx, top + RAIL_H * 0.5, z]} color={PLANK} />
        </group>
      ))}
      {[rx0 + 2, rx1 - 2].flatMap((x) =>
        sides.map((z) => (
          <Box
            key={`${x},${z}`}
            size={[0.4, top - SAND_BOTTOM, 0.4]}
            position={[x, (top + SAND_BOTTOM) / 2 - 0.1, z]}
            color={PLANK_DARK}
            cast={false}
          />
        )),
      )}
    </group>
  )
}

function IconLabel({ text, icon, color, position, height }) {
  const { texture, aspect } = useMemo(() => makeIconLabelTexture(text, { icon, color }), [text, icon, color])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

const STONE = '#a3a8b8'
const STONE_DARK = '#7d8294'

function Pillar({ z }) {
  const { x, pillarSize: s, height: h } = AREA2_GATE
  return (
    <group position={[x, GROUND_Y, z]}>
      <Box size={[s + 0.3, 0.4, s + 0.3]} position={[0, 0.2, 0]} color={STONE_DARK} />
      <Box size={[s, h, s]} position={[0, h / 2, 0]} color={STONE} />
      <Box size={[s + 0.3, 0.4, s + 0.3]} position={[0, h + 0.2, 0]} color={STONE_DARK} />
    </group>
  )
}

// Two stone pillars flanking the bridge mouth; while locked, a translucent
// green force-field between them reads "AREA 2" and the Rebirths needed.
// systems/area2.js's resolveArea2Walls is what actually blocks the way.
function Gate() {
  const unlocked = useGameStore((s) => isArea2Unlocked(s.rebirth))
  const [za, zb] = AREA2_GATE.pillarZ
  const inner = zb - za - AREA2_GATE.pillarSize
  const h = AREA2_GATE.height
  const faceX = AREA2_GATE.x - 1.5
  return (
    <group>
      <Pillar z={za} />
      <Pillar z={zb} />
      {!unlocked && (
        <>
          <mesh position={[AREA2_GATE.x, GROUND_Y + h / 2, (za + zb) / 2]}>
            <boxGeometry args={[0.3, h, inner]} />
            <meshStandardMaterial
              color="#2fd35a"
              emissive="#1f9e45"
              emissiveIntensity={0.5}
              transparent
              opacity={0.55}
              depthWrite={false}
              {...MATERIAL_PBR.GLASS}
            />
          </mesh>
          <Label text="AREA 2" color="#f4f0ff" position={[faceX, GROUND_Y + 2.8, (za + zb) / 2]} height={1.6} />
          <IconLabel
            text={String(AREA2_GATE.requiredRebirths)}
            icon="rebirth"
            color="#ff4fa3"
            position={[faceX, GROUND_Y + 1.5, (za + zb) / 2]}
            height={1.2}
          />
        </>
      )}
    </group>
  )
}

function formatClock(seconds) {
  const s = Math.ceil(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const AFK_INTERVAL_TEXT = `EVERY ${formatClock(AFK_ZONE.intervalSec)}`

// "EVERY 3:00" normally; counts down to the next payout while the player
// stands in the zone. Only re-renders when the shown text changes.
function AfkTimerLabel({ position }) {
  const [text, setText] = useState(AFK_INTERVAL_TEXT)
  useFrame(() => {
    const next = afkState.inside ? formatClock(afkSecondsLeft()) : AFK_INTERVAL_TEXT
    if (next !== text) setText(next)
  })
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color: '#ffd23d' }), [text])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.6
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

const COIN = '#ffcb3d'
const COIN_R = 0.28
const COIN_H = 0.07

const _coinObj = new Object3D()
const _coinColor = new Color()

// Every loose coin (floor piles + crate tops) as one instanced draw.
function Coins() {
  const coins = useMemo(() => {
    const out = []
    for (const p of AFK_COIN_PILES) {
      for (let i = 0; i < p.count; i++) {
        const a = p.yaw + i * 2.1
        const d = i === 0 ? 0 : 0.3
        out.push([p.x + Math.cos(a) * d, AFK_Y + COIN_H / 2 + (i === p.count - 1 && i > 1 ? COIN_H : 0), p.z + Math.sin(a) * d, 0.15 * i])
      }
    }
    for (const c of AFK_CRATES) {
      for (let i = 0; i < 5; i++) {
        const a = c.yaw + i * 1.3
        out.push([c.x + Math.cos(a) * 0.35 * (i % 3), GROUND_Y + 1.4 + COIN_H / 2 + (i > 2 ? COIN_H : 0), c.z + Math.sin(a) * 0.35 * (i % 3), 0.3 * i])
      }
    }
    return out
  }, [])
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    coins.forEach(([x, y, z, tilt], i) => {
      _coinObj.position.set(x, y, z)
      _coinObj.rotation.set(tilt * 0.3, 0, tilt * 0.2)
      _coinObj.updateMatrix()
      mesh.setMatrixAt(i, _coinObj.matrix)
      mesh.setColorAt(i, _coinColor.set(COIN))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [coins])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, coins.length]} castShadow receiveShadow>
      <cylinderGeometry args={[COIN_R, COIN_R, COIN_H, 14]} />
      <Mat color="#ffffff" emissive="#ffae00" emissiveIntensity={0.25} metalness={0.3} roughness={0.4} />
    </instancedMesh>
  )
}

function Crate({ x, z, yaw }) {
  const s = 1.4
  return (
    <group position={[x, GROUND_Y, z]} rotation-y={yaw}>
      <Box size={[s, s, s]} position={[0, s / 2, 0]} color="#b4623a" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box size={[s + 0.04, 0.16, 0.16]} position={[0, 0.08, (side * s) / 2]} color="#7a3b20" />
          <Box size={[s + 0.04, 0.16, 0.16]} position={[0, s - 0.08, (side * s) / 2]} color="#7a3b20" />
          <Box size={[0.16, s, 0.16]} position={[(side * s) / 2, s / 2, (side * s) / 2]} color="#7a3b20" />
          <Box size={[0.16, s, 0.16]} position={[(side * s) / 2, s / 2, (-side * s) / 2]} color="#7a3b20" />
        </group>
      ))}
    </group>
  )
}

function AfkZone() {
  const [x0, z0, x1, z1] = AFK_ZONE.rect
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  return (
    <group>
      {AFK_CRATES.map((c) => (
        <Crate key={`${c.x},${c.z}`} {...c} />
      ))}
      <Coins />
      <Label text="AFK ZONE" color="#ffd23d" position={[cx, GROUND_Y + 4.6, cz]} height={1.1} />
      <IconLabel
        text={`+${AFK_ZONE.rewardCoins}`}
        icon="coin"
        color="#ffffff"
        position={[cx, GROUND_Y + 3.75, cz]}
        height={0.8}
      />
      <AfkTimerLabel position={[cx, GROUND_Y + 3.1, cz]} />
    </group>
  )
}

export default function Area2() {
  return (
    <>
      <Terrain />
      <Bridge />
      <Gate />
      <AgeMachines config={AREA2_AGE_MACHINES} />
      <AfkZone />
    </>
  )
}
