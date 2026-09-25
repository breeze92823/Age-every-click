import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y } from '../data/world.js'
import {
  AGE_MACHINES,
  FREE_BOOTH,
  SIGN_BOARD,
  SHOP,
  STATUE,
  SPAWN_PAD,
  PETS,
  OBBY,
  LEADERBOARDS,
  TRAMPOLINE,
} from '../data/island.js'
import {
  makeLabelTexture,
  makeTierLabelTexture,
  makeChevronTexture,
  makePriceTagTexture,
  makeBuyButtonTexture,
} from '../systems/canvasTextures.js'
import { formatCompact } from '../systems/format.js'
import { useGameStore } from '../store/useGameStore.js'
import { playButtonClick, playActionFail } from '../systems/sfx.js'

// The hub's set pieces, laid out per data/island.js. Visual only for now —
// nothing here is interactive or collidable yet. Everything faces +Z, toward
// the spawn camera. Heights are in metres against the 1.8 m player.

const WOOD = '#9c6232'
const WOOD_DARK = '#6e4221'
const STONE = '#a9aeb8'
const METAL = '#2e3138'
// AgeMachine's glass shell radius — shared with AgeMachines so the price/Buy
// banner can sit flush against its +Z (camera-facing) surface.
const GLASS_RADIUS = 0.6

function Mat({ color, ...props }) {
  return <meshStandardMaterial color={color} {...MATERIAL_PBR.PROP} {...props} />
}

function Box({ size, position, rotation, color, cast = true, ...mat }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <Mat color={color} {...mat} />
    </mesh>
  )
}

// World-sized billboard text that always faces the camera.
function Label({ text, color, position, height = 0.8 }) {
  const { texture, aspect } = useMemo(() => makeLabelTexture(text, { color }), [text, color])
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
// banner. Disappears once the machine is owned (AgeMachines below).
function PriceTag({ price, position }) {
  const { texture, aspect } = useMemo(() => makePriceTagTexture(formatCompact(price)), [price])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.4
  return (
    <sprite position={position} scale={[height * aspect, height, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}

// Clickable "Buy" pill under the price tag. Fixed to face +Z (not a
// billboard like the other labels) so it doesn't turn toward whichever side
// the player is viewing from. A plane's default normal already points +Z,
// so no rotation is needed. Meshes raycast like sprites do, so this still
// takes r3f's onClick directly.
//
// There's no earn loop yet (see useGameStore's buyAgeMachine comment), so
// wins sits at 0 and every click currently fails the affordability check —
// with nothing else wired up that read as the button not being clickable at
// all. A click now always plays a sound (success click or fail buzz) so it's
// never silent, and the cursor turns to a pointer on hover to signal it's
// interactive in the first place.
function BuyButton({ index, position }) {
  const buyAgeMachine = useGameStore((s) => s.buyAgeMachine)
  const { texture, aspect } = useMemo(() => makeBuyButtonTexture(), [])
  useEffect(() => () => texture.dispose(), [texture])
  const height = 0.34
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        if (buyAgeMachine(index)) playButtonClick()
        else playActionFail()
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

function AgeMachine({ x, color, emissive, emissiveIntensity }) {
  const domeEmissive = emissive ? emissiveIntensity : 0
  return (
    <group position={[x, 0.4, 0]}>
      <mesh position-y={0.2} castShadow receiveShadow>
        <cylinderGeometry args={[0.8, 0.9, 0.4, 16]} />
        <Mat color={color} emissive={emissive} emissiveIntensity={domeEmissive} />
      </mesh>
      <mesh position={[0, 1.4, -0.72]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 2, 12]} />
        <Mat color={METAL} />
      </mesh>
      <mesh position={[0, 2.4, -0.585]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.27, 12]} />
        <Mat color={METAL} />
      </mesh>
      <mesh position-y={1.3}>
        <cylinderGeometry args={[GLASS_RADIUS, GLASS_RADIUS, 1.8, 20, 1, true]} />
        <meshStandardMaterial
          color="#dff3ff"
          transparent
          opacity={0.3}
          depthWrite={false}
          side={DoubleSide}
          {...MATERIAL_PBR.GLASS}
        />
      </mesh>
      <mesh position-y={2.3} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.2, 16]} />
        <Mat color={color} emissive={emissive} emissiveIntensity={domeEmissive} />
      </mesh>
      <mesh position-y={2.4} castShadow>
        <sphereGeometry args={[0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color={color} emissive={emissive} emissiveIntensity={domeEmissive} />
      </mesh>
    </group>
  )
}

function AgeMachines() {
  const { z, spacing, tiers, standDepth, standHeight } = AGE_MACHINES
  const ownedAgeMachines = useGameStore((s) => s.ownedAgeMachines)
  const mid = (tiers.length - 1) / 2
  return (
    <group position={[0, GROUND_Y, z]}>
      <Box
        size={[tiers.length * spacing + 1, standHeight, standDepth]}
        position={[0, standHeight / 2, 0]}
        color="#5b606b"
      />
      {tiers.map((t, i) => {
        const x = (i - mid) * spacing
        const forSale = t.price != null && !ownedAgeMachines.has(i)
        return (
          <group key={t.name}>
            <AgeMachine x={x} color={t.color} emissive={t.emissive} emissiveIntensity={t.emissiveIntensity} />
            <TierLabel name={t.name} rate={t.rate} color={t.emissive ?? t.color} position={[x, 3.7, 0]} />
            {forSale && (
              <>
                <PriceTag price={t.price} position={[x, 1.95, GLASS_RADIUS + 0.4]} />
                <BuyButton index={i} position={[x, 1.55, GLASS_RADIUS + 0.1]} />
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
      <Label text="FREE" color="#ffd23d" position={[0, 3, 0]} height={0.9} />
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
    <group position={[SHOP.x, GROUND_Y, SHOP.z]}>
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
      <Label text="SHOP" color="#ffd23d" position={[0, 4.1, 0]} height={1} />
    </group>
  )
}

function Statue() {
  return (
    <group position={[STATUE.x, GROUND_Y, STATUE.z]} rotation-y={STATUE.yaw}>
      <Box size={[1.8, 0.6, 1.8]} position={[0, 0.3, 0]} color="#8e939c" />
      <Box size={[1.2, 0.3, 1.2]} position={[0, 0.75, 0]} color="#9aa0aa" />
      <mesh position={[0, 2.35, 0]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[1, 1, 1.25]} castShadow>
        <cylinderGeometry args={[1.25, 1.25, 0.3, 24]} />
        <Mat color={STONE} />
      </mesh>
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
      <Label text="PETS" color="#ffd23d" position={[0, 3.3, 0]} height={0.9} />
    </group>
  )
}

function Obby() {
  const arrows = useMemo(() => makeChevronTexture({ color: '#5fe35a', count: 3 }), [])
  useEffect(() => () => arrows.dispose(), [arrows])
  return (
    <group position={[OBBY.x, GROUND_Y, 0]}>
      <Label text="OBBY" color="#ffd23d" position={[0, 4.4, OBBY.signZ]} height={1.6} />
      {OBBY.pads.map(({ z, name, color }) => (
        <group key={name} position-z={z}>
          <Box size={[2.4, 0.5, 2.4]} position={[0, 0.25, 0]} color="#d8dbe1" />
          <Box size={[2, 0.08, 2]} position={[0, 0.54, 0]} color={color} cast={false} />
          <Label text={name} color={color} position={[0, 1.7, 0]} height={0.55} />
          <mesh position={[-3.8, 0.035, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[3.6, 1.2]} />
            <meshStandardMaterial map={arrows} transparent depthWrite={false} {...MATERIAL_PBR.PATH} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Leaderboard({ x, z, title, color }) {
  return (
    <group position={[x, GROUND_Y, z]}>
      <Box size={[0.25, 3.2, 0.25]} position={[-1.5, 1.6, 0]} color={WOOD_DARK} />
      <Box size={[0.25, 3.2, 0.25]} position={[1.5, 1.6, 0]} color={WOOD_DARK} />
      <Box size={[3.4, 2.4, 0.3]} position={[0, 2.3, 0]} color={WOOD} />
      <Box size={[3, 2, 0.05]} position={[0, 2.3, 0.17]} color="#5b3419" cast={false} />
      {[3, 2.6, 2.2, 1.8].map((y) => (
        <Box key={y} size={[2.4, 0.14, 0.02]} position={[0, y, 0.2]} color="#e8d3a8" cast={false} />
      ))}
      <Label text={title} color={color} position={[0, 3.95, 0]} height={0.65} />
    </group>
  )
}

function Trampoline() {
  const { x, z, radius } = TRAMPOLINE
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
      <mesh position-y={0.5} receiveShadow>
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
      <Pets />
      <Obby />
      {LEADERBOARDS.map((b) => (
        <Leaderboard key={b.title} {...b} />
      ))}
      <Trampoline />
    </>
  )
}
