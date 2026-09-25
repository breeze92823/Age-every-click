import { GROUND_Y } from './world.js'

// Layout for the Tsunami Escape obby, entered from OBBY's Tsunami Escape
// pad: a long brick-walled trench with a grass rim and raised green safe
// slabs spanning its full width, running toward -Z.
// Plain world metres (no ISLAND_SCALE), same convention as
// studJumpsScene.js. Rects are [x0, z0, x1, z1].

export const WALL_HEIGHT = 4
export const BASE_BOTTOM = GROUND_Y - 6

export const OUTER_RECT = [-14, -72, 14, 8]
export const PIT_RECT = [-11, -69, 11, 5]

const SLAB_X = [PIT_RECT[0], PIT_RECT[2]]
const SLAB_HEIGHT = 1.5
export const SLABS = [
  { z: [-14, -2], color: 'green' },
  { z: [-25, -17], color: 'green' },
  { z: [-35, -28], color: 'green' },
  { z: [-46, -38], color: 'green' },
  { z: [-53, -49], color: 'green' },
].map((s) => ({ ...s, rect: [SLAB_X[0], s.z[0], SLAB_X[1], s.z[1]], top: GROUND_Y + SLAB_HEIGHT }))

// Waves roll from the last slab's far edge toward +Z until they have passed
// over the first slab, then vanish, so the reward strip beyond stays clear. Their base rides at slab-top height, so the gaps
// between slabs are where the player hides from them. Up to maxActive run at
// once, each a random type, spawned at least minGap metres apart.
export const WAVE = {
  startZ: SLABS[SLABS.length - 1].rect[1],
  endZ: SLABS[0].rect[3],
  bottom: GROUND_Y + SLAB_HEIGHT,
  height: 4,
  // Hit band behind the wave's front line.
  depth: 1.5,
  maxActive: 2,
  minGap: 25, // metres kept between two waves, including a faster one catching up
  delay: [1, 3], // random seconds between spawns
  firstDelay: 1.5,
}

export const WAVE_TYPES = [
  { label: '⚠ SLOW', color: '#8fdcff', emissive: '#1f4a5c', speed: 5 },
  { label: '⚠ MEDIUM', color: '#ffe21a', emissive: '#5a4a00', speed: 9 },
  { label: '⚠ FAST', color: '#ff3b30', emissive: '#5c0f0b', speed: 14 },
]

// Green floor strip at the far end the reward pad sits on.
export const END_RECT = [PIT_RECT[0], -69, PIT_RECT[2], -56]

export const VIP_SIGNS_Z = [-21, -33, -45]
export const CHEAP_SIGN = { x: -8.5, z: 2.5 }
export const EXIT_PAD = { x: 8.5, z: 1.5, size: 1.6 }
export const REWARD_PAD = { x: 0, z: -64, size: 2 }
export const REWARD_COINS = 200
export const SPAWN = { x: 0, y: GROUND_Y, z: 1.5 }
