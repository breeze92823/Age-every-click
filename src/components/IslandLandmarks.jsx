import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, ExtrudeGeometry, MeshStandardMaterial, Object3D, Path, Shape, ShapeGeometry, SphereGeometry, Vector2 } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y, ISLAND_SCALE } from '../data/world.js'
import { ageMachineSpot } from '../data/area2.js'
import { resetPlayer } from '../systems/playerState.js'
import { getLastBounceAt } from '../systems/trampoline.js'
import {
  AGE_MACHINES,
  FREE_BOOTH,
  SIGN_BOARD,
  SHOP,
  STATUE,
  WIN_SIGN,
  SPAWN_PAD,
  PETS,
  OBBY,
  LEADERBOARDS,
  TRAMPOLINE,
  SHOW_SHOP_FREE_PETS_LABELS,
} from '../data/island.js'
import { LEADERBOARD_VISIBLE_ROWS, LEADERBOARD_POLL_MS } from '../data/net.js'
import {
  makeLabelTexture,
  makeTierLabelTexture,
  makeChevronTexture,
  makePriceTagTexture,
  makeBuyButtonTexture,
  makeStatusTagTexture,
  makeLeaderboardTexture,
  makeWheelFaceTexture,
  makeGlassGridTexture,
  makeLavaTexture,
} from '../systems/canvasTextures.js'
import { makeStudTexture, shade } from '../systems/studTexture.js'
import { formatCompact } from '../systems/format.js'
import { formatShort } from '../data/format.js'
import { useGameStore } from '../store/useGameStore.js'
import { getLeaderboard, subscribe as subscribeNet } from '../systems/net.js'
import { playButtonClick, playActionFail } from '../systems/sfx.js'
import { showActionResult } from '../systems/actionResult.js'

// The hub's set pieces, laid out per data/island.js. Everything faces +Z,
// toward the spawn camera. Heights are in metres against the 1.8 m player.
// Most of these are static obstacles the player collides with, including the
// Obby entry pads — see landmarkCollision.js for the blocking radii and
// what's deliberately left walkable (SpawnPad, the Trampoline).

const WOOD = '#9c6232'
const WOOD_DARK = '#6e4221'
const STONE = '#a9aeb8'
const METAL = '#2e3138'
// AgeMachine's glass shell radius — shared with AgeMachines so the price/Buy
// banner can sit flush against its +Z (camera-facing) surface.
const GLASS_RADIUS = 0.6

export function Mat({ color, ...props }) {
  return <meshStandardMaterial color={color} {...MATERIAL_PBR.PROP} {...props} />
}

export function Box({ size, position, rotation, color, cast = true, ...mat }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <Mat color={color} {...mat} />
    </mesh>
  )
}

// World-sized billboard text that always faces the camera.
// `gradient` should be a stable (module-level) array so the memo holds.
export function Label({ text, color, position, height = 0.8, gradient }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color, gradient }), [text, color, gradient])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

// Two-line billboard label for a machine's tier name + Age/s rate.
function TierLabel({ name, rate, color, position }) {
  const { texture, aspect } = useMemo(() => makeTierLabelTexture(name, rate, { nameColor: color }), [name, rate, color])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.6
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

// Coin + price capsule, stacked above BuyButton — the top half of the buy
// banner. Disappears once the machine is owned (AgeMachines below). `text`
// is either a formatted coin amount or a tier's priceLabel override (e.g.
// VIP's "Cannot buy with coin").
function PriceTag({ text, position }) {
  const { texture, aspect } = useMemo(() => makePriceTagTexture(text), [text])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.4
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

// Plain black pill that replaces PriceTag once a machine is owned.
function OwnedTag({ position }) {
  const { texture, aspect } = useMemo(() => makeStatusTagTexture('Owned'), [])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.4
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

// Clickable pill under the price/owned tag — reads "Buy" before purchase and
// "Use" after. Fixed to face +Z (not a billboard like the other labels) so
// it doesn't turn toward whichever side the player is viewing from. A
// plane's default normal already points +Z, so no rotation is needed.
// Meshes raycast like sprites do, so this still takes r3f's onClick directly.
//
// Once owned, "Use" teleports the player onto the machine's stand and locks
// them there (see useGameStore's enterAgeMachine/ridingAgeMachine and
// playerMovement.js's freeze) until they tap the Return button. `index` is
// the store index (data/area2.js's ALL_AGE_MACHINE_TIERS), which also says
// which stand to park the player on.
function BuyButton({ index, owned, price, position }) {
  const buyAgeMachine = useGameStore((s) => s.buyAgeMachine)
  const enterAgeMachine = useGameStore((s) => s.enterAgeMachine)
  const label = owned ? 'Use' : 'Buy'
  const { texture, aspect } = useMemo(() => makeBuyButtonTexture({ label }), [label])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.34
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        if (owned) {
          if (enterAgeMachine(index)) {
            playButtonClick()
            const spot = ageMachineSpot(index)
            resetPlayer({ x: spot.x * ISLAND_SCALE, y: spot.topY + 1, z: spot.z * ISLAND_SCALE })
          } else {
            playActionFail()
          }
        } else if (buyAgeMachine(index)) {
          playButtonClick()
        } else if (price != null) {
          showActionResult(`Need ${formatCompact(price)} Coins to Buy`, false)
        } else {
          playActionFail()
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'auto'
      }}
    >
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} side={DoubleSide} />
    </mesh>
  )
}

// Glowing shape inside the glass — a light-beam pillar or a stacked tree,
// per the tier's `core` (data/island.js).
function AgeMachineCore({ shape, color }) {
  if (shape === 'tree') {
    return (
      <group position-y={0.4}>
        {[
          [0.42, 0.55, 0.45],
          [0.33, 0.5, 0.8],
          [0.24, 0.45, 1.12],
          [0.15, 0.4, 1.4],
        ].map(([r, h, y]) => (
          <mesh key={y} position-y={y}>
            <coneGeometry args={[r, h, 4]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.45}
              transparent
              opacity={0.7}
              {...MATERIAL_PBR.PROP}
            />
          </mesh>
        ))}
      </group>
    )
  }
  if (shape === 'sparkle') {
    // Four-point star: two stretched octahedra crossed, over a soft glow ball.
    return (
      <group position-y={1.3}>
        {[
          [0.07, 0.42, 0.07],
          [0.42, 0.07, 0.07],
        ].map((scale) => (
          <mesh key={scale[0]} scale={scale}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.1, 12, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.32, 16, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      </group>
    )
  }
  return (
    <group position-y={1.3}>
      <mesh>
        <cylinderGeometry args={[0.09, 0.09, 1.8, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} {...MATERIAL_PBR.PROP} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 1.8, 14, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function AgeMachine({ x, tier }) {
  const { color, emissive, emissiveIntensity, glass = '#dff3ff', blocky, lava, core, knob } = tier
  // Blocky tiers get studded bodies and gridded glass, lava tiers glowing
  // cracks (body and side pole); the rest keep flat materials.
  const bodyMap = useMemo(() => {
    if (lava) return makeLavaTexture()
    if (blocky) return makeStudTexture({ light: color, dark: shade(color, -0.08), studsPerCell: 1, repeatX: 8, repeatY: 1 })
    return null
  }, [lava, blocky, color])
  const glassMap = useMemo(() => (blocky ? makeGlassGridTexture() : null), [blocky])
  useEffect(() => () => bodyMap?.dispose(), [bodyMap])
  useEffect(() => () => glassMap?.dispose(), [glassMap])
  // A map multiplies the material color, and both bitmaps are already
  // painted in the tier's colors, so the material itself goes white. Lava
  // reuses its map as the emissiveMap so only the cracks glow.
  let skin
  if (lava) skin = { color: '#ffffff', map: bodyMap, emissive: '#ffffff', emissiveMap: bodyMap, emissiveIntensity: 0.9 }
  else if (bodyMap) skin = { color: '#ffffff', map: bodyMap }
  else skin = { color, emissive, emissiveIntensity: emissive ? emissiveIntensity : 0 }
  const pole = lava ? skin : { color: METAL }
  return (
    <group position={[x, 0.4, 0]}>
      <mesh position-y={0.2} castShadow receiveShadow>
        <cylinderGeometry args={[0.8, 0.9, 0.4, 16]} />
        <Mat {...skin} />
      </mesh>
      <mesh position={[0, 1.4, -0.72]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 2, 12]} />
        <Mat {...pole} />
      </mesh>
      <mesh position={[0, 2.4, -0.585]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.27, 12]} />
        <Mat {...pole} />
      </mesh>
      <mesh position-y={1.3}>
        <cylinderGeometry args={[GLASS_RADIUS, GLASS_RADIUS, 1.8, 20, 1, true]} />
        <meshStandardMaterial
          color={glassMap ? '#d6f2ff' : glass}
          map={glassMap}
          transparent
          opacity={glassMap ? 0.6 : 0.3}
          depthWrite={false}
          side={DoubleSide}
          {...MATERIAL_PBR.GLASS}
        />
      </mesh>
      {core && <AgeMachineCore shape={core.shape} color={core.color} />}
      <mesh position-y={2.3} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.2, 16]} />
        <Mat {...skin} />
      </mesh>
      <mesh position-y={2.4} castShadow>
        <sphereGeometry args={[0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat {...skin} />
      </mesh>
      {blocky && (
        <mesh position-y={2.92} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.18, 12]} />
          <Mat color={knob ?? color} />
        </mesh>
      )}
    </group>
  )
}

// One stand of machines. Defaults to the hub's; Area2.jsx passes its own
// (data/area2.js's AREA2_AGE_MACHINES), whose `firstIndex` offsets each
// machine's store index past the hub's.
export function AgeMachines({ config = AGE_MACHINES }) {
  const { x: standX = 0, z, spacing, tiers, standDepth, standHeight, firstIndex = 0 } = config
  const ownedAgeMachines = useGameStore((s) => s.ownedAgeMachines)
  const mid = (tiers.length - 1) / 2
  return (
    <group position={[standX, GROUND_Y, z]}>
      <Box
        size={[tiers.length * spacing + 1, standHeight, standDepth]}
        position={[0, standHeight / 2, 0]}
        color="#5b606b"
      />
      {tiers.map((t, i) => {
        const x = (i - mid) * spacing
        const index = firstIndex + i
        const owned = ownedAgeMachines.has(index)
        const purchasable = t.price != null || t.priceLabel != null
        return (
          <group key={t.name}>
            <AgeMachine x={x} tier={t} />
            <TierLabel name={t.name} rate={t.rate} color={t.labelColor ?? t.emissive ?? t.color} position={[x, 3.7, 0]} />
            {(purchasable || owned) && (
              <>
                {owned ? (
                  <OwnedTag position={[x, 1.95, GLASS_RADIUS + 0.4]} />
                ) : (
                  <PriceTag text={t.priceLabel ?? formatCompact(t.price)} position={[x, 1.95, GLASS_RADIUS + 0.4]} />
                )}
                <BuyButton index={index} owned={owned} price={t.price} position={[x, 1.55, GLASS_RADIUS + 0.1]} />
              </>
            )}
          </group>
        )
      })}
      <Label text="AGE MACHINES" color="#ffd23d" position={[0, 5.4, 0]} height={1.1} />
    </group>
  )
}

function FreeBooth() {
  return (
    <group position={[FREE_BOOTH.x, GROUND_Y, FREE_BOOTH.z]}>
      <Box size={[2.8, 0.5, 2]} position={[0, 0.25, 0]} color="#e0342f" />
      <Box size={[2.2, 0.1, 1.4]} position={[0, 0.55, 0.2]} color="#2f7de0" />
      <Box size={[2.8, 1.8, 0.25]} position={[0, 1.4, -0.9]} color="#2f7de0" />
      {[0.95, 1.4, 1.85].map((y) => (
        <Box key={y} size={[2.82, 0.12, 0.27]} position={[0, y, -0.9]} color="#ffffff" cast={false} />
      ))}
      <Box size={[0.7, 0.7, 0.7]} position={[0, 0.95, 0.2]} color="#ffd23d" />
      <Box size={[0.72, 0.72, 0.16]} position={[0, 0.95, 0.2]} color="#e0342f" cast={false} />
      {SHOW_SHOP_FREE_PETS_LABELS && <Label text="FREE" color="#ffd23d" position={[0, 3, 0]} height={0.9} />}
    </group>
  )
}

function SignBoard() {
  return (
    <group position={[SIGN_BOARD.x, GROUND_Y, SIGN_BOARD.z]} rotation-y={SIGN_BOARD.yaw}>
      <Box size={[0.2, 2.2, 0.2]} position={[-1.3, 1.1, 0]} color={WOOD_DARK} />
      <Box size={[0.2, 2.2, 0.2]} position={[1.3, 1.1, 0]} color={WOOD_DARK} />
      <Box size={[3, 1.8, 0.2]} position={[0, 2, 0]} color={WOOD} />
      <Box size={[2.6, 1.4, 0.05]} position={[0, 2, 0.12]} color="#2f6b3a" cast={false} />
      {[2.4, 2.05, 1.7].map((y, i) => (
        <Box key={y} size={[1.9 - i * 0.4, 0.12, 0.02]} position={[0, y, 0.15]} color="#e9f5e2" cast={false} />
      ))}
    </group>
  )
}

function Shop() {
  const stripes = 6
  const awningWidth = 3.8
  const stripeWidth = awningWidth / stripes
  return (
    <group position={[SHOP.x, GROUND_Y, SHOP.z]} rotation-y={Math.PI}>
      <Box size={[3.4, 2.6, 0.2]} position={[0, 1.3, -0.9]} color="#c98a4b" />
      <Box size={[3.4, 1, 1.2]} position={[0, 0.5, 0.6]} color="#b5703a" />
      <Box size={[3.6, 0.12, 1.4]} position={[0, 1.06, 0.6]} color={WOOD_DARK} />
      {[
        [-1.6, -0.8],
        [1.6, -0.8],
        [-1.6, 1.2],
        [1.6, 1.2],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 1.4, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 2.8, 8]} />
          <Mat color="#f2f2f2" />
        </mesh>
      ))}
      <group position={[0, 2.95, 0.2]} rotation-x={0.2}>
        {Array.from({ length: stripes }, (_, i) => (
          <Box
            key={i}
            size={[stripeWidth, 0.14, 2.6]}
            position={[(i - (stripes - 1) / 2) * stripeWidth, 0, 0]}
            color={i % 2 ? '#ffffff' : '#e53935'}
          />
        ))}
      </group>
      {SHOW_SHOP_FREE_PETS_LABELS && <Label text="SHOP" color="#ffd23d" position={[0, 4.1, 0]} height={1} />}
    </group>
  )
}

// Statue's original design yaw — the medallion's facing is pinned to this,
// not to the live STATUE.yaw, so that turning the statue (STATUE.yaw) turns
// the whole thing, medallion included, instead of the medallion silently
// undoing the change to keep facing the leaderboards.
const STATUE_BASE_YAW = -0.5

// How much the medallion's face glows on its own, so it reads bright like
// the Lucky Wheel popup even when the statue sits in shade.
const WHEEL_FACE_GLOW = 0.35
// Medallion size and height. The upper base tops out at y = 1.1, and the tilted
// disc reaches ~0.99 * radius below its centre, so the centre sits a little
// over 1.1 + 1.25 * WHEEL_SCALE up to keep the disc clear of the base.
const WHEEL_SCALE = 1.5
const WHEEL_CENTER_Y = 3.05
// The face turns clockwise (seen from the front) in an endless slow loop.
const WHEEL_SPIN_SPEED = 0.35 // rad/s, ~18 s per turn

function Statue() {
  const faceTexture = useMemo(() => makeWheelFaceTexture(), [])
  useEffect(() => () => faceTexture.dispose(), [faceTexture])
  const spinRef = useRef(null)
  useFrame((_, dt) => {
    if (spinRef.current) spinRef.current.rotation.y -= WHEEL_SPIN_SPEED * dt
  })
  const leaderboardYaw = useMemo(() => {
    const cx = (LEADERBOARDS[0].x + LEADERBOARDS[1].x) / 2
    const cz = (LEADERBOARDS[0].z + LEADERBOARDS[1].z) / 2
    return Math.atan2(cx - STATUE.x, cz - STATUE.z) - STATUE_BASE_YAW
  }, [])
  return (
    <group position={[STATUE.x, GROUND_Y, STATUE.z]} rotation-y={STATUE.yaw}>
      <Box size={[1.8, 0.6, 1.8]} position={[0, 0.3, 0]} color="#c4c9d2" emissive="#c4c9d2" emissiveIntensity={0.25} />
      <Box size={[1.2, 0.5, 1.2]} position={[0, 0.85, 0]} color="#d0d5de" emissive="#d0d5de" emissiveIntensity={0.25} />
      <group position={[0, WHEEL_CENTER_Y, 0]} rotation-y={leaderboardYaw} scale={WHEEL_SCALE}>
        <group rotation-x={Math.PI / 2 - 0.15}>
          <mesh castShadow>
            <cylinderGeometry args={[1.25, 1.25, 0.3, 48]} />
            <Mat color="#d0d5de" emissive="#d0d5de" emissiveIntensity={0.25} />
          </mesh>
          {/* The Lucky Wheel popup's face, on the outward (leaderboard-facing)
              side only — the back face and rim stay plain stone. Laid flat
              with rotation-x so the texture's top points up once the group's
              tilt stands the disc upright. */}
          <group ref={spinRef}>
            <mesh position-y={0.151} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[1.24, 64]} />
              <Mat map={faceTexture} emissive="#ffffff" emissiveMap={faceTexture} emissiveIntensity={WHEEL_FACE_GLOW} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

// Marquee arrow beside the Statue: a hollow red arrow frame ringed with
// blinking bulbs, "Win" inside, pointing at the statue (-X) from two chrome
// poles. Built tip-toward-+X then mirrored so it points the way it should.
const ARROW_TAIL = -1.6
const ARROW_HEAD_BASE = 0.8
const ARROW_TIP = 1.7
const ARROW_SHAFT_H = 0.3
const ARROW_HEAD_H = 0.68
const ARROW_BORDER = 0.08
const ARROW_DEPTH = 0.16
const ARROW_BEVEL = 0.02
const ARROW_TILT = 0.12
const BULB_SPACING = 0.32
const BULB_COLOR = '#fff2b0'
const FRAME_FRONT_Z = ARROW_DEPTH / 2 + ARROW_BEVEL

// Counter-clockwise outline, mirrored so the tip points -X.
const ARROW_OUTLINE = [
  [ARROW_TAIL, -ARROW_SHAFT_H],
  [ARROW_HEAD_BASE, -ARROW_SHAFT_H],
  [ARROW_HEAD_BASE, -ARROW_HEAD_H],
  [ARROW_TIP, 0],
  [ARROW_HEAD_BASE, ARROW_HEAD_H],
  [ARROW_HEAD_BASE, ARROW_SHAFT_H],
  [ARROW_TAIL, ARROW_SHAFT_H],
]
  .map(([x, y]) => [-x, y])
  .reverse()

// Mitre-offsets a counter-clockwise polygon inward by d.
function insetPolygon(pts, d) {
  const n = pts.length
  const lines = pts.map(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % n]
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    return { px: x0 - (dy / len) * d, py: y0 + (dx / len) * d, dx, dy }
  })
  return pts.map((_, i) => {
    const a = lines[(i - 1 + n) % n]
    const b = lines[i]
    const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / (a.dx * b.dy - a.dy * b.dx)
    return [a.px + a.dx * t, a.py + a.dy * t]
  })
}

// Evenly spaced points around a closed polygon's edges (one per spacing).
function pointsAlong(pts, spacing) {
  const out = []
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length]
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / spacing))
    for (let s = 0; s < steps; s++) out.push([x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps])
  })
  return out
}

const toVectors = (pts) => pts.map(([x, y]) => new Vector2(x, y))

function WinSign() {
  const { frameGeo, backingGeo, bulbs } = useMemo(() => {
    const inner = insetPolygon(ARROW_OUTLINE, ARROW_BORDER)
    const shape = new Shape(toVectors(ARROW_OUTLINE))
    shape.holes.push(new Path(toVectors(inner)))
    const frame = new ExtrudeGeometry(shape, {
      depth: ARROW_DEPTH,
      bevelEnabled: true,
      bevelThickness: ARROW_BEVEL,
      bevelSize: ARROW_BEVEL,
      bevelSegments: 2,
    })
    frame.translate(0, 0, -ARROW_DEPTH / 2)
    return {
      frameGeo: frame,
      backingGeo: new ShapeGeometry(new Shape(toVectors(inner))),
      bulbs: pointsAlong(insetPolygon(ARROW_OUTLINE, ARROW_BORDER / 2), BULB_SPACING),
    }
  }, [])
  const { texture: winTexture, aspect: winAspect } = useMemo(
    () => makeLabelTexture('Win', { color: '#ffd23d', stroke: '#5a0d0d' }),
    [],
  )
  // Even/odd bulbs share a material each, so the chase blink is two updates a frame.
  const bulbMats = useMemo(
    () => [0, 1].map(() => new MeshStandardMaterial({ color: BULB_COLOR, emissive: '#ffd86b', emissiveIntensity: 1 })),
    [],
  )
  const bulbGeo = useMemo(() => new SphereGeometry(0.055, 10, 8), [])
  useEffect(
    () => () => {
      frameGeo.dispose()
      backingGeo.dispose()
      winTexture.dispose()
      bulbGeo.dispose()
      bulbMats.forEach((m) => m.dispose())
    },
    [frameGeo, backingGeo, winTexture, bulbGeo, bulbMats],
  )
  useFrame(({ clock }) => {
    const phase = Math.floor(clock.elapsedTime * 2.5) % 2
    bulbMats.forEach((m, i) => {
      m.emissiveIntensity = i === phase ? 2.2 : 0.5
    })
  })

  const textHeight = 0.44
  const textX = 0.4
  const poleTop = (dx) => WIN_SIGN.y - ARROW_SHAFT_H + dx * Math.tan(ARROW_TILT) + 0.04
  return (
    <group position={[WIN_SIGN.x, GROUND_Y, WIN_SIGN.z]} scale={WIN_SIGN.scale} rotation-y={WIN_SIGN.yaw}>
      {WIN_SIGN.poleDx.map((dx) => (
        <group key={dx} position-x={dx}>
          <mesh position-y={poleTop(dx) / 2} castShadow>
            <cylinderGeometry args={[0.05, 0.05, poleTop(dx), 10]} />
            <Mat color="#e6eaf0" emissive="#e6eaf0" emissiveIntensity={0.3} metalness={0.2} roughness={0.4} />
          </mesh>
          <mesh position-y={0.02} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.17, 0.04, 16]} />
            <Mat color="#e6eaf0" emissive="#e6eaf0" emissiveIntensity={0.3} metalness={0.2} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <group position-y={WIN_SIGN.y} rotation-z={ARROW_TILT}>
        <mesh geometry={frameGeo} castShadow>
          <Mat color="#ff2a33" emissive="#ff2a33" emissiveIntensity={0.5} metalness={0.1} roughness={0.35} />
        </mesh>
        <mesh geometry={backingGeo}>
          <Mat color="#4a2f5c" emissive="#4a2f5c" emissiveIntensity={0.4} side={DoubleSide} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} position={[textX, 0, side * 0.006]} rotation-y={side === 1 ? 0 : Math.PI}>
            <planeGeometry args={[textHeight * winAspect, textHeight]} />
            <meshBasicMaterial map={winTexture} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
        {[1, -1].map((side) =>
          bulbs.map(([x, y], i) => (
            <mesh
              key={`${side}-${i}`}
              geometry={bulbGeo}
              material={bulbMats[i % 2]}
              position={[x, y, side * (FRAME_FRONT_Z - 0.01)]}
            />
          )),
        )}
      </group>
    </group>
  )
}

function SpawnPad() {
  const spikes = 8
  return (
    <group position={[SPAWN_PAD.x, GROUND_Y + 0.02, SPAWN_PAD.z]}>
      <mesh position-y={0.03} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.06, 16]} />
        <Mat color="#2b2d33" />
      </mesh>
      {Array.from({ length: spikes }, (_, i) => {
        const a = (i / spikes) * Math.PI * 2
        return (
          <Box
            key={i}
            size={[0.25, 0.06, 0.9]}
            position={[Math.sin(a) * 1.2, 0.03, Math.cos(a) * 1.2]}
            rotation={[0, a, 0]}
            color="#2b2d33"
            cast={false}
          />
        )
      })}
      <mesh position-y={0.07}>
        <cylinderGeometry args={[0.35, 0.35, 0.04, 16]} />
        <Mat color="#e8e8e8" />
      </mesh>
    </group>
  )
}

function Pets() {
  return (
    <group position={[PETS.x, GROUND_Y, PETS.z]}>
      <Box size={[5, 0.3, 5]} position={[0, 0.15, 0]} color="#b8bcc5" />
      <mesh position-y={0.6} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1, 0.6, 16]} />
        <Mat color="#8e939c" />
      </mesh>
      <mesh position-y={1.55} scale={[1, 1.3, 1]} castShadow>
        <sphereGeometry args={[0.6, 20, 14]} />
        <Mat color="#3fbf5a" />
      </mesh>
      <Box size={[1.2, 2, 1.2]} position={[1.7, 1.3, -1.6]} color="#d6d9df" />
      {SHOW_SHOP_FREE_PETS_LABELS && <Label text="PETS" color="#ffd23d" position={[0, 3.3, 0]} height={0.9} />}
    </group>
  )
}

// Obby pad miniatures: each pad is a studded grey brick base (the 2.4x2.4
// footprint landmarkCollision.js blocks) topped with a toy-sized preview of
// the scene it leads to. Models run along local Z so they read left-to-right
// for a player approaching from -X along the chevron path.
const PAD_SIZE = 2.4
const PAD_H = 0.5
const PAD_BASE = '#d8dbe1'
const STUD_R = 0.085
const STUD_H = 0.06
const RAINBOW = ['#ff3b3b', '#ff8a2b', '#ffd23d', '#5fe35a', '#35d0ff', '#3d6bff', '#a24cf0']

// Centered offsets for `n` studs `spacing` apart.
const studRow = (n, spacing) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * spacing)

// Studs on the top face of a box centered at (cx, cz) whose top is at `y`.
function topStuds(cx, cz, nx, nz, spacing, y, c) {
  const out = []
  for (const dx of studRow(nx, spacing)) for (const dz of studRow(nz, spacing)) out.push({ p: [cx + dx, y + STUD_H / 2, cz + dz], c })
  return out
}

// One row of studs around the four sides of the pad base, Roblox-brick style.
function baseSideStuds() {
  const out = []
  const e = PAD_SIZE / 2 + STUD_H / 2
  const y = PAD_H / 2
  for (const t of studRow(5, 0.44)) {
    out.push({ p: [e, y, t], r: [0, 0, Math.PI / 2], c: PAD_BASE })
    out.push({ p: [-e, y, t], r: [0, 0, Math.PI / 2], c: PAD_BASE })
    out.push({ p: [t, y, e], r: [Math.PI / 2, 0, 0], c: PAD_BASE })
    out.push({ p: [t, y, -e], r: [Math.PI / 2, 0, 0], c: PAD_BASE })
  }
  return out
}

const _studObj = new Object3D()
const _studColor = new Color()

// All of one model's studs as a single instanced draw, colored per stud.
function Studs({ studs }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    studs.forEach(({ p, r = [0, 0, 0], c }, i) => {
      _studObj.position.set(...p)
      _studObj.rotation.set(...r)
      _studObj.updateMatrix()
      mesh.setMatrixAt(i, _studObj.matrix)
      mesh.setColorAt(i, _studColor.set(c))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [studs])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, studs.length]} castShadow receiveShadow>
      <cylinderGeometry args={[STUD_R, STUD_R, STUD_H, 12]} />
      <Mat color="#ffffff" />
    </instancedMesh>
  )
}

// Tsunami Escape: grass-on-dirt island slab with a cyan wave curling over it.
const TSUNAMI_TOP = PAD_H + 0.22 + 0.1
const TSUNAMI_STUDS = baseSideStuds()

function makeWaveGeometry() {
  const s = new Shape()
  s.moveTo(-0.75, 0)
  s.lineTo(0.55, 0)
  s.quadraticCurveTo(0.75, 0.7, 0.45, 1.25) // back of the wave up to the crest
  s.quadraticCurveTo(0.3, 1.22, 0.24, 1.06) // lip curling forward
  s.quadraticCurveTo(0.35, 0.35, -0.75, 0) // concave face down to the trough
  const g = new ExtrudeGeometry(s, { depth: 0.6, curveSegments: 16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 })
  g.translate(0, 0, -0.3)
  return g
}

function TsunamiEscapeModel() {
  const wave = useMemo(makeWaveGeometry, [])
  useEffect(() => () => wave.dispose(), [wave])
  return (
    <>
      <Box size={[2.2, 0.22, 2.2]} position={[0, PAD_H + 0.11, 0]} color="#c9703d" />
      <Box size={[2.2, 0.1, 2.2]} position={[0, PAD_H + 0.27, 0]} color="#6fdc3c" />
      <mesh geometry={wave} position={[0, TSUNAMI_TOP, 0]} rotation-y={-Math.PI / 2 + 0.45} castShadow receiveShadow>
        <Mat color="#35d0ff" emissive="#1a8fd0" emissiveIntensity={0.35} transparent opacity={0.92} />
      </mesh>
      <Studs studs={TSUNAMI_STUDS} />
    </>
  )
}

// Stud Jumps: a rainbow staircase of studded brick columns rising along Z.
const STAIR_W = 0.27
const STAIR_STEP = 0.2
const STAIR_DEPTH = 0.54

const STUD_JUMPS_STUDS = [
  ...baseSideStuds(),
  ...RAINBOW.flatMap((c, i) => topStuds(0, (i - (RAINBOW.length - 1) / 2) * STAIR_W, 2, 1, STAIR_W, PAD_H + (i + 1) * STAIR_STEP, c)),
]

function StudJumpsModel() {
  return (
    <>
      {RAINBOW.map((c, i) => {
        const h = (i + 1) * STAIR_STEP
        return <Box key={c} size={[STAIR_DEPTH, h, STAIR_W]} position={[0, PAD_H + h / 2, (i - (RAINBOW.length - 1) / 2) * STAIR_W]} color={c} />
      })}
      <Studs studs={STUD_JUMPS_STUDS} />
    </>
  )
}

// Impossible Bridge: two green brick towers over a dark gap, joined by a
// two-lane bridge of alternating magenta/white glass tiles.
const BRIDGE_TOWER = 0.6
const BRIDGE_TOWER_Z = 0.8
const BRIDGE_Y = PAD_H + BRIDGE_TOWER
const BRIDGE_LEN = 2 * BRIDGE_TOWER_Z - BRIDGE_TOWER
const BRIDGE_ROWS = 4

const IMPOSSIBLE_BRIDGE_STUDS = [
  ...baseSideStuds(),
  ...[-BRIDGE_TOWER_Z, BRIDGE_TOWER_Z].flatMap((z) => topStuds(0, z, 2, 2, 0.28, BRIDGE_Y, '#62d63a')),
]

function ImpossibleBridgeModel() {
  const tileLen = BRIDGE_LEN / BRIDGE_ROWS
  return (
    <>
      <Box size={[2.2, 0.06, 2.2]} position={[0, PAD_H + 0.03, 0]} color="#2b3544" cast={false} />
      {[-BRIDGE_TOWER_Z, BRIDGE_TOWER_Z].map((z) => (
        <Box key={z} size={[BRIDGE_TOWER, BRIDGE_TOWER, BRIDGE_TOWER]} position={[0, PAD_H + BRIDGE_TOWER / 2, z]} color="#62d63a" />
      ))}
      {[-0.3, 0.3].map((x) => (
        <Box key={x} size={[0.04, 0.06, BRIDGE_LEN]} position={[x, BRIDGE_Y - 0.03, 0]} color="#ffffff" />
      ))}
      {[-0.14, 0.14].flatMap((x, col) =>
        Array.from({ length: BRIDGE_ROWS }, (_, row) => (
          <Box
            key={`${col}-${row}`}
            size={[0.26, 0.04, tileLen - 0.03]}
            position={[x, BRIDGE_Y - 0.03, (row - (BRIDGE_ROWS - 1) / 2) * tileLen]}
            color={(col + row) % 2 ? '#e04cf0' : '#f7e8ff'}
            transparent
            opacity={0.88}
          />
        )),
      )}
      <Studs studs={IMPOSSIBLE_BRIDGE_STUDS} />
    </>
  )
}

// Keyed by data/island.js's OBBY.pads names, so each model always sits on
// (and under the label of) the pad whose scene it previews.
const PAD_MODELS = {
  'Impossible Bridge': ImpossibleBridgeModel,
  'Stud Jumps': StudJumpsModel,
  'Tsunami Escape': TsunamiEscapeModel,
}
const PAD_TITLE_GRADIENT = { 'Stud Jumps': RAINBOW }

function Obby() {
  const arrows = useMemo(() => makeChevronTexture({ color: '#5fe35a', count: 3 }), [])
  useEffect(() => () => arrows.dispose(), [arrows])
  return (
    <group position={[OBBY.x, GROUND_Y, 0]}>
      <Label text="OBBY" color="#ffd23d" position={[0, 4.4, OBBY.signZ+5]} height={1.6} />
      {OBBY.pads.map(({ z, name, color, minCoins }) => {
        const Model = PAD_MODELS[name]
        return (
          <group key={name} position-z={z}>
            <Box size={[PAD_SIZE, PAD_H, PAD_SIZE]} position={[0, PAD_H / 2, 0]} color={PAD_BASE} />
            {Model && <Model />}
            <Label text={`+🪙${minCoins} min`} color="#ffd23d" position={[0, 3.05, 0]} height={0.4} />
            <Label text={name} color={color} gradient={PAD_TITLE_GRADIENT[name]} position={[0, 2.6, 0]} height={0.55} />
            <mesh position={[-3.8, 0.035, 0]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[3.6, 1.2]} />
              <meshStandardMaterial map={arrows} transparent depthWrite={false} {...MATERIAL_PBR.PATH} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// Polls systems/net.js's getLeaderboard(stat, limit) on LEADERBOARD_POLL_MS
// rather than reactively on every store change: an actively-clicking player's
// `speed` changes many times a second, and redrawing this board's canvas
// texture that often (a real recreate + redraw, unlike drei <Text>) would be
// wasted work for a board nobody can read that fast anyway. Also refreshes
// immediately whenever systems/net.js emits (a fresh 'leaderboard' broadcast,
// or a connect/disconnect), so the board doesn't sit on stale rows for a full
// poll interval after those.
function useLeaderboardRows(stat) {
  const [rows, setRows] = useState(() => getLeaderboard(stat, LEADERBOARD_VISIBLE_ROWS))
  useEffect(() => {
    const tick = () => setRows(getLeaderboard(stat, LEADERBOARD_VISIBLE_ROWS))
    tick()
    const offNet = subscribeNet(tick)
    const poll = setInterval(tick, LEADERBOARD_POLL_MS)
    return () => {
      offNet()
      clearInterval(poll)
    }
  }, [stat])
  return rows
}

// `stat` (data/island.js's LEADERBOARDS) makes this board LIVE: rows come
// from systems/net.js's getLeaderboard(stat, limit) — our own row straight
// off the live store, every other row from whichever players are currently
// online/saved (Age-every-click-backend's merged leaderboard broadcast).
// Offline/solo, or before a game server is configured, that degrades to just
// our own row — same "never blocks, never intrudes" stance as the rest of
// the netcode. The "Top Age" board (`stat === 'speed'`) prefixes its values
// with "Age " to match the HUD's own "Age: N" convention (components/hud/
// LevelBar.jsx); "Top Coins" shows the bare formatted number. Each row's
// `isSelf` (the local player vs. every other, remote player) rides through
// to makeLeaderboardTexture so it can highlight our own row on the board.
function Leaderboard({ x, z, title, color, stat }) {
  const rows = useLeaderboardRows(stat)
  const entries = useMemo(
    () =>
      rows.map((row) => ({
        name: row.name,
        value: stat === 'speed' ? `Age ${formatShort(row.value)}` : formatShort(row.value),
        isSelf: row.isSelf,
      })),
    [rows, stat],
  )
  const texture = useMemo(
    () => makeLeaderboardTexture(entries, { accent: color, slots: LEADERBOARD_VISIBLE_ROWS }),
    [entries, color],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={[x, GROUND_Y, z]} rotation={[0, Math.PI, 0]}>
      <Box size={[0.25, 3.2, 0.25]} position={[-1.5, 1.6, 0]} color="#a26c3c" emissive="#a26c3c" emissiveIntensity={0.3} />
      <Box size={[0.25, 3.2, 0.25]} position={[1.5, 1.6, 0]} color="#a26c3c" emissive="#a26c3c" emissiveIntensity={0.3} />
      <Box size={[3.4, 2.4, 0.3]} position={[0, 2.3, 0]} color="#c68a4e" emissive="#c68a4e" emissiveIntensity={0.3} />
      <Box size={[3, 2, 0.05]} position={[0, 2.3, 0.17]} color="#8a5a30" emissive="#8a5a30" emissiveIntensity={0.3} cast={false} />
      <mesh position={[0, 2.3, 0.2]}>
        <planeGeometry args={[2.7, 1.8]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Label text={title} color={color} position={[0, 3.95, 0]} height={0.65} />
    </group>
  )
}

const BED_Y = 0.5
const BED_DIP = 0.18 // m the bed sinks at the moment of a bounce
const BED_DIP_MS = 350

function Trampoline() {
  const { x, z, radius } = TRAMPOLINE
  const bed = useRef()

  // Dips the bed on each bounce and eases it back up.
  useFrame(() => {
    const t = (performance.now() - getLastBounceAt()) / BED_DIP_MS
    bed.current.position.y = t < 1 ? BED_Y - BED_DIP * (1 - t) ** 2 : BED_Y
  })

  return (
    <group position={[x, GROUND_Y, z]}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh key={i} position={[Math.cos(a) * radius * 0.8, 0.25, Math.sin(a) * radius * 0.8]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
            <Mat color={METAL} />
          </mesh>
        )
      })}
      <mesh ref={bed} position-y={BED_Y} receiveShadow>
        <cylinderGeometry args={[radius - 0.05, radius - 0.05, 0.05, 32]} />
        <Mat color="#1c1e24" />
      </mesh>
      <mesh position-y={0.52} rotation-x={-Math.PI / 2} castShadow>
        <torusGeometry args={[radius, 0.2, 10, 32]} />
        <Mat color="#2f8ff0" />
      </mesh>
    </group>
  )
}

export default function IslandLandmarks() {
  return (
    <>
      <SpawnPad />
      <AgeMachines />
      <FreeBooth />
      <SignBoard />
      <Shop />
      <Statue />
      <WinSign />
      <Pets />
      <Obby />
      {LEADERBOARDS.map((b) => (
        <Leaderboard key={b.title} {...b} />
      ))}
      <Trampoline />
    </>
  )
}
