import { GROUND_Y } from './world.js'

// Layout for the glass-bridge obby behind the Impossible Bridge pad. Plain
// world metres (no ISLAND_SCALE). Two physical platforms — Start (far, -Z)
// and Finish/end (near, close to the portal in) — named for their position,
// not their gameplay role: SPAWN_RECT/FINISH_RECT below name which platform
// the tiles/timer treat as the start vs the finish of the course. The real
// win trigger is EXIT_PAD (on the spawn platform), not a pad on FINISH_RECT
// — see EXIT_PAD's comment below. The player's actual SPAWN point, near the
// bottom of this file, is placed beside the (decorative) FINISH_PAD, by
// request, so it's on the opposite platform from EXIT_PAD.

export const START_RECT = [-5, -30, 5, -20]
export const END_RECT = [-3.5, -4, 3.5, 4]
export const PLATFORM_THICKNESS = 1.6

// Gameplay roles — swap these two if the direction of the course ever
// needs to flip again, instead of touching the derived values below.
export const SPAWN_RECT = END_RECT
export const FINISH_RECT = START_RECT

export const TILE_SIZE = 2.2
export const TILE_THICKNESS = 0.25
export const LANE_X = [-1.35, 1.35]
export const COLUMN_PITCH = 2.6
// First column sits 1.5 m off the spawn platform's bridge-facing edge (its
// z0), stepping toward the finish platform on the other side of the gap.
export const FIRST_COLUMN_Z = SPAWN_RECT[1] - 1.5
// The last column is the fixed green-arrow (safe) / red-X (breaks) pair;
// every column before it gets a random safe lane per attempt.
export const COLUMNS = 6

// Glass frame the tiles sit in, spanning the physical gap between the two
// platforms — unaffected by which one is spawn vs finish.
export const BRIDGE_RECT = [-2.75, START_RECT[3], 2.75, END_RECT[1]]

// Yellow pad on the spawn platform: this is the real finish trigger
// (systems/bonusBridge.js's onFinishPad) — stepping on it pays out
// REWARD_COINS and returns to the island, not just being anywhere on the
// platform.
export const EXIT_PAD = { x: -2, z: SPAWN_RECT[1] + 5.8, size: 1.6 }

// Green pad on the finish platform, just past its bridge-facing edge (z1).
// Purely decorative — it marks the far end of the course, but the actual
// win trigger is EXIT_PAD above.
export const FINISH_PAD = { x: 0, z: FINISH_RECT[3] - 2, size: 1.8 }

// Just beside the (decorative) finish pad, on the finish platform.
export const SPAWN = { x: FINISH_PAD.x, y: GROUND_Y, z: FINISH_PAD.z - FINISH_PAD.size / 2 - 0.6 }

export const TIME_LIMIT = 15 // seconds, counted from leaving the spawn platform
export const REWARD_COINS = 200
export const FALL_RESET_Y = GROUND_Y - 12
