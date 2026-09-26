import { GROUND_Y, ISLAND_SCALE } from './world.js'
import { AGE_MACHINES, HALF_W, mulberry32 } from './island.js'

// Area 2: a second island east of the hub, reached over a wooden bridge
// that continues the hub's east-west road. Same conventions as
// data/island.js — rects are [x0, z0, x1, z1] in local (pre-ISLAND_SCALE)
// metres, -Z is north — and it renders inside Island.jsx's scaled group, so
// the hub itself is untouched.

export const AREA2_CORE = [42, -27, 78, 9]
const [A2_X0, A2_Z0, A2_X1, A2_Z1] = AREA2_CORE

// Deck spans from inside the hub's east edge to inside Area 2's west edge,
// lined up with the hub's east-west road (z -12..-6).
export const BRIDGE = { rect: [HALF_W - 1, -11.5, A2_X0 + 1, -6.5], deckHeight: 0.08 }
// Railings run only over open water, between the two coastlines.
export const BRIDGE_RAIL_X = [HALF_W + 1, A2_X0 - 1]
export const BRIDGE_RAIL_INSET = 0.25

export const AREA2_PATHS = [
  [A2_X0, -12, 50, -6], // road from the gate
  [50, -20, 72, 2], // plaza around the AFK zone
]

// Locked until the player has this many Rebirths. The barrier is only drawn
// across the bridge mouth, but the invisible wall is the whole x = gate.x
// line (see systems/area2Gate.js) — the bridge is the only way over anyway.
export const AREA2_GATE = {
  x: A2_X0-0.4,
  pillarZ: [-14.5, -3.5],
  pillarSize: 1.6,
  height: 4.2,
  requiredRebirths: 5,
}

export const AFK_ZONE = {
  rect: [54, -16, 68, -2],
  intervalSec: 180,
  rewardCoins: 100,
}

// Wooden crates of coins sitting in the AFK zone — solid, like the hub's
// other props.
export const AFK_CRATES = [
  { x: 57, z: -12.5, yaw: 0.2 },
  { x: 65, z: -5.5, yaw: -0.3 },
]

// Continues the hub's tiers: same fields, same Buy/Use banner.
const AREA2_AGE_MACHINE_TIERS = [
  { name: 'Ruby', rate: '+8 Age/s', ageRate: 8, color: '#ff2d3f', glass: '#ffb3bb', price: 12000 },
  { name: 'Amethyst', rate: '+9 Age/s', ageRate: 9, color: '#b04cff', glass: '#e2c2ff', price: 15000 },
  { name: 'Sapphire', rate: '+10 Age/s', ageRate: 10, color: '#27d4ff', glass: '#bff1ff', price: 18000 },
  {
    name: 'Double Molten',
    rate: '+11 Age/s',
    ageRate: 11,
    color: '#231710',
    emissive: '#ff5a1f',
    emissiveIntensity: 0.9,
    glass: '#ffc08a',
    price: 22000,
  },
]

// Same shape as data/island.js's AGE_MACHINES, plus `x` (the stand's centre)
// and `firstIndex`: these tiers own indices firstIndex.. in the store's
// ownedAgeMachines/ridingAgeMachine, after the hub's.
export const AREA2_AGE_MACHINES = {
  x: 58,
  z: -23.5,
  spacing: AGE_MACHINES.spacing,
  standDepth: AGE_MACHINES.standDepth,
  standHeight: AGE_MACHINES.standHeight,
  tiers: AREA2_AGE_MACHINE_TIERS,
  colors: AREA2_AGE_MACHINE_TIERS.map((t) => t.color),
  firstIndex: AGE_MACHINES.tiers.length,
}

// Every Age Machine in the game, by store index.
export const ALL_AGE_MACHINE_TIERS = [...AGE_MACHINES.tiers, ...AREA2_AGE_MACHINE_TIERS]

const STANDS = [
  { ...AGE_MACHINES, x: 0, firstIndex: 0 },
  AREA2_AGE_MACHINES,
]

// Local x/z of machine `index` (a store index) plus the world-space top of
// its stand — where "Use" parks the player and "Return" lets them off.
export function ageMachineSpot(index) {
  for (const s of STANDS) {
    const i = index - s.firstIndex
    if (i < 0 || i >= s.tiers.length) continue
    const mid = (s.tiers.length - 1) / 2
    return { x: s.x + (i - mid) * s.spacing, z: s.z, topY: GROUND_Y + s.standHeight * ISLAND_SCALE }
  }
  return null
}

// Every machine's local centre, across both stands — for collision.
export const ALL_AGE_MACHINE_CENTERS = ALL_AGE_MACHINE_TIERS.map((_, i) => ageMachineSpot(i))

// Every stand's local footprint rect + world top height — for terrainHeight.
export const AGE_MACHINE_STANDS = STANDS.map((s) => {
  const halfW = (s.tiers.length * s.spacing + 1) / 2
  const halfD = s.standDepth / 2
  return { rect: [s.x - halfW, s.z - halfD, s.x + halfW, s.z + halfD], topY: GROUND_Y + s.standHeight * ISLAND_SCALE }
})

const rng = mulberry32(20260926)

// Stepped coastline, same recipe as the hub's buildEdge.
const EDGE_STEP = 4
function buildEdge() {
  const chunks = []
  const w = A2_X1 - A2_X0
  const sides = [
    (a, out) => [A2_X0 + a, A2_Z0 - out, A2_X0 + a + EDGE_STEP, A2_Z0],
    (a, out) => [A2_X0 + a, A2_Z1, A2_X0 + a + EDGE_STEP, A2_Z1 + out],
    (a, out) => [A2_X0 - out, A2_Z0 + a, A2_X0, A2_Z0 + a + EDGE_STEP],
    (a, out) => [A2_X1, A2_Z0 + a, A2_X1 + out, A2_Z0 + a + EDGE_STEP],
  ]
  for (const side of sides) {
    for (let a = 0; a < w; a += EDGE_STEP) {
      const grassOut = Math.floor(rng() * 3)
      const sandOut = grassOut + 0.8 + rng() * 1.2
      chunks.push({ grass: grassOut > 0 ? side(a, grassOut) : null, sand: side(a, sandOut) })
    }
  }
  return chunks
}
export const AREA2_EDGE = buildEdge()

export const AREA2_GRASS_RECTS = [AREA2_CORE, ...AREA2_EDGE.filter((c) => c.grass).map((c) => c.grass)]

const [SX0, SZ0, SX1, SZ1] = AGE_MACHINE_STANDS[1].rect
const BLOCKED = [
  ...AREA2_PATHS,
  [SX0 - 1, SZ0 - 2, SX1 + 1, SZ1 + 1],
  [A2_X0 - 2, -17, AREA2_GATE.x + 2, -1],
]
const placed = []

function isClear(x, z, r) {
  for (const [x0, z0, x1, z1] of BLOCKED) {
    if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false
  }
  for (const p of placed) {
    if (Math.hypot(p.x - x, p.z - z) < p.r + r) return false
  }
  return true
}

const CX = (A2_X0 + A2_X1) / 2
const CZ = (A2_Z0 + A2_Z1) / 2
const DECOR_HALF = (A2_X1 - A2_X0) / 2 - 1.5

function scatter(count, r, accept = () => true) {
  const out = []
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const x = CX + (rng() * 2 - 1) * DECOR_HALF
    const z = CZ + (rng() * 2 - 1) * DECOR_HALF
    if (!accept(x, z) || !isClear(x, z, r)) continue
    const item = { x, z, r, yaw: rng() * Math.PI * 2, scale: 0.9 + rng() * 0.25, variant: rng() }
    placed.push(item)
    out.push(item)
  }
  return out
}

export const AREA2_TREES = scatter(18, 2, (x, z) => Math.max(Math.abs(x - CX), Math.abs(z - CZ)) > 12 || rng() < 0.3)
export const AREA2_BUSHES = scatter(12, 1.1)
export const AREA2_ROCKS = scatter(6, 0.9)
export const AREA2_FLOWERS = scatter(12, 0.5)

// Little piles of gold coins scattered over the AFK zone's floor.
export const AFK_COIN_PILES = (() => {
  const [x0, z0, x1, z1] = AFK_ZONE.rect
  const out = []
  for (let tries = 0; out.length < 14 && tries < 400; tries++) {
    const x = x0 + 1 + rng() * (x1 - x0 - 2)
    const z = z0 + 1 + rng() * (z1 - z0 - 2)
    if (AFK_CRATES.some((c) => Math.hypot(c.x - x, c.z - z) < 1.8)) continue
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) continue
    out.push({ x, z, count: 2 + Math.floor(rng() * 3), yaw: rng() * Math.PI })
  }
  return out
})()
