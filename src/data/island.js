import { ISLAND_WIDTH, ISLAND_DEPTH, ISLAND_SCALE, SPAWN } from './world.js'

// Hub layout for the island, as data. Rects are [x0, z0, x1, z1] in world
// metres; -Z is "north", the way the camera faces from the spawn. Scale
// reference: the player is 1.8 m tall and a tree about twice that.

export const HALF_W = ISLAND_WIDTH / 2
export const HALF_D = ISLAND_DEPTH / 2
export const CORE = [-HALF_W, -HALF_D, HALF_W, HALF_D]

export const PATHS = [
  [-HALF_W, -12, HALF_W, -6], // east-west road
  [-16, -29, 16, 10], // central plaza
  [16, -6, 26, 10], // obby apron
  [-7, 10, 7, 16], // leaderboard apron
  [16, -29, 23, -21], // pets corner
]

// Grass beds inset into the plaza, ringed by a chevron-conveyor curb.
export const ENCLOSURES = [
  [-11, -24, 9, -15],
  [-11, -4, 11, 7],
]
export const ENCLOSURE_BORDER = 1.2
// Curb ring height and grass-bed depth, both above GROUND_Y (local, i.e.
// pre-ISLAND_SCALE) — shared by the island mesh and by terrainHeight.js,
// which turns them into a physical step the player climbs instead of clipping.
export const CURB_HEIGHT = 0.14
export const BED_DEPTH = 0.03

export const SPAWN_PAD = { x: SPAWN.x / ISLAND_SCALE, z: SPAWN.z / ISLAND_SCALE }

// One tier per machine, left to right — name/rate/dome color match the
// reference art. Molten also glows a little to read as lava rather than
// flat black. `ageRate` is `rate`'s number (Age gained per second while
// riding the machine — see useGameStore's tickAgeMachine); `rate` stays the
// display string so the two can't drift, but is kept as-authored since
// canvasTextures.js already renders it verbatim.
const AGE_MACHINE_TIERS = [
  { name: 'Basic', rate: '+1 Age/s', ageRate: 1, color: '#eef1f6', price: 100 },
  { name: 'Double', rate: '+2 Age/s', ageRate: 2, color: '#9096a1', price: 2000 },
  { name: 'Gold', rate: '+3 Age/s', ageRate: 3, color: '#ffcb3d', price: 3500 },
  { name: 'VIP', rate: '+4 Age/s', ageRate: 4, color: '#ff5b7f', price: 5000 },
  { name: 'Diamond', rate: '+5 Age/s', ageRate: 5, color: '#5fc9ff', price: 6500 },
  { name: 'Emerald', rate: '+6 Age/s', ageRate: 6, color: '#3ddb6a', price: 8000 },
  { name: 'Molten', rate: '+7 Age/s', ageRate: 7, color: '#231710', emissive: '#ff5a1f', emissiveIntensity: 0.6, price: 9500 },
]

export const AGE_MACHINES = {
  z: -26.5,
  spacing: 2.4,
  // Stand footprint/height, both local (pre-ISLAND_SCALE) — shared by the
  // landmark mesh and by terrainHeight.js so the player steps onto it
  // instead of clipping through.
  standDepth: 3,
  standHeight: 0.4,
  tiers: AGE_MACHINE_TIERS,
  colors: AGE_MACHINE_TIERS.map((t) => t.color),
}

export const FREE_BOOTH = { x: -3, z: -20 }
export const SIGN_BOARD = { x: 4, z: -20, yaw: -0.35 }
export const SHOP = { x: -2.5, z: 1 }
export const STATUE = { x: 5, z: 1, yaw: -0.5 }
export const PETS = { x: 19.5, z: -25 }

// Temporarily hidden (not yet content-ready) — the "FREE"/"SHOP"/"PETS"
// billboard labels above those landmarks only render when explicitly opted
// into via .env. The models themselves (and their collision) stay as-is.
// See .env.example.
export const SHOW_SHOP_FREE_PETS_LABELS = import.meta.env.VITE_SHOW_SHOP_FREE_PETS_LABELS === 'true'

export const OBBY = {
  x: 23,
  signZ: -4.2,
  pads: [
    { z: -1, name: 'Impossible Bridge', color: '#e04cf0' },
    { z: 3, name: 'Stud Jumps', color: '#ffae2b' },
    { z: 7, name: 'Tsunami Escape', color: '#35d0ff' },
  ],
}

// `stat` is the store/useGameStore.js field each board ranks by — also what
// systems/net.js's getLeaderboard(stat, limit) reads. components/
// IslandLandmarks.jsx's Leaderboard component polls that live, merged
// (online + all-time-saved) ranking instead of a fixed roster; offline/solo
// (or before a game server is configured) it degrades to just the local
// player's own row, same "never blocks, never intrudes" stance as the rest
// of the netcode.
export const LEADERBOARDS = [
  { x: -2.8, z: 13.5, title: 'Top Coins', color: '#ffd23d', stat: 'coins' },
  { x: 2.8, z: 13.5, title: 'Top Age', color: '#4fd8ff', stat: 'speed' },
]

export const TRAMPOLINE = { x: -20, z: 8, radius: 1.6 }

// Seeded so the island looks the same on every load and for every player.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260925)

// Stepped coastline: each EDGE_STEP-long run of every side pushes the grass
// out 0-2 m, with a sand ledge poking out a little further beneath it.
const EDGE_STEP = 4
function buildEdge() {
  const chunks = []
  const sides = [
    (a, out) => [a, -HALF_D - out, a + EDGE_STEP, -HALF_D],
    (a, out) => [a, HALF_D, a + EDGE_STEP, HALF_D + out],
    (a, out) => [-HALF_W - out, a, -HALF_W, a + EDGE_STEP],
    (a, out) => [HALF_W, a, HALF_W + out, a + EDGE_STEP],
  ]
  for (const side of sides) {
    for (let a = -HALF_W; a < HALF_W; a += EDGE_STEP) {
      const grassOut = Math.floor(rng() * 3)
      const sandOut = grassOut + 0.8 + rng() * 1.2
      chunks.push({ grass: grassOut > 0 ? side(a, grassOut) : null, sand: side(a, sandOut) })
    }
  }
  return chunks
}
export const EDGE = buildEdge()

const DECOR_BOUNDS = Math.min(HALF_W, HALF_D) - 1.5
const BLOCKED = [
  ...PATHS,
  [TRAMPOLINE.x - 2.5, TRAMPOLINE.z - 2.5, TRAMPOLINE.x + 2.5, TRAMPOLINE.z + 2.5],
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

function scatter(count, r, accept = () => true) {
  const out = []
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const x = (rng() * 2 - 1) * DECOR_BOUNDS
    const z = (rng() * 2 - 1) * DECOR_BOUNDS
    if (!accept(x, z) || !isClear(x, z, r)) continue
    const item = { x, z, r, yaw: rng() * Math.PI * 2, scale: 0.9 + rng() * 0.25, variant: rng() }
    placed.push(item)
    out.push(item)
  }
  return out
}

const ENCLOSURE_BUSHES = [
  [-8.5, -17.5],
  [6.5, -17.5],
  [-8, 4.5],
  [8, 4.5],
  [-8, -1.5],
].map(([x, z]) => ({ x, z, yaw: 0.3, scale: 0.8, variant: 0.5 }))

// Trees crowd the coast and thin out toward the middle, as in the hub art.
export const TREES = scatter(36, 2, (x, z) => Math.max(Math.abs(x), Math.abs(z)) > 20 || rng() < 0.35)
export const BUSHES = [...ENCLOSURE_BUSHES, ...scatter(24, 1.1)]
export const ROCKS = scatter(14, 0.9)
export const FLOWERS = scatter(22, 0.5)
