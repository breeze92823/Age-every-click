import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y, ISLAND_SCALE } from '../data/world.js'
import { AGE_MACHINES_TOP_Y } from '../systems/terrainHeight.js'
import { resetPlayer } from '../systems/playerState.js'
import { getLastBounceAt } from '../systems/trampoline.js'
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
} from '../systems/canvasTextures.js'
import { formatCompact } from '../systems/format.js'
import { formatShort } from '../data/format.js'
import { useGameStore } from '../store/useGameStore.js'
import { getLeaderboard, subscribe as subscribeNet } from '../systems/net.js'
import { playButtonClick, playActionFail } from '../systems/sfx.js'
import { showActionResult } from '../systems/actionResult.js'

// The hub's set pieces, laid out per data/island.js. Everything faces +Z,
// toward the spawn camera. Heights are in metres against the 1.8 m player.
// Most of these are static obstacles the player collides with — see
// landmarkCollision.js for the blocking radii and what's deliberately left
// walkable (SpawnPad, the Obby pads, the Trampoline).

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
// playerMovement.js's freeze) until they tap the Return button.
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
            resetPlayer({ x: position[0] * ISLAND_SCALE, y: AGE_MACHINES_TOP_Y + 1, z: AGE_MACHINES.z * ISLAND_SCALE })
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
        const owned = ownedAgeMachines.has(i)
        const purchasable = t.price != null || t.priceLabel != null
        return (
          <group key={t.name}>
            <AgeMachine x={x} color={t.color} emissive={t.emissive} emissiveIntensity={t.emissiveIntensity} />
            <TierLabel name={t.name} rate={t.rate} color={t.emissive ?? t.color} position={[x, 3.7, 0]} />
            {(purchasable || owned) && (
              <>
                {owned ? (
                  <OwnedTag position={[x, 1.95, GLASS_RADIUS + 0.4]} />
                ) : (
                  <PriceTag text={t.priceLabel ?? formatCompact(t.price)} position={[x, 1.95, GLASS_RADIUS + 0.4]} />
                )}
                <BuyButton index={i} owned={owned} price={t.price} position={[x, 1.55, GLASS_RADIUS + 0.1]} />
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
      {SHOW_SHOP_FREE_PETS_LABELS && <Label text="SHOP" color="#ffd23d" position={[0, 4.1, 0]} height={1} />}
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
      {SHOW_SHOP_FREE_PETS_LABELS && <Label text="PETS" color="#ffd23d" position={[0, 3.3, 0]} height={0.9} />}
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
      <Box size={[0.25, 3.2, 0.25]} position={[-1.5, 1.6, 0]} color={WOOD_DARK} />
      <Box size={[0.25, 3.2, 0.25]} position={[1.5, 1.6, 0]} color={WOOD_DARK} />
      <Box size={[3.4, 2.4, 0.3]} position={[0, 2.3, 0]} color={WOOD} />
      <Box size={[3, 2, 0.05]} position={[0, 2.3, 0.17]} color="#5b3419" cast={false} />
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
      <Pets />
      <Obby />
      {LEADERBOARDS.map((b) => (
        <Leaderboard key={b.title} {...b} />
      ))}
      <Trampoline />
    </>
  )
}
