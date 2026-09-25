import { GROUND_Y } from './world.js'

// Layout for the glass-bridge obby behind the Impossible Bridge pad. Plain
// world metres (no ISLAND_SCALE). Two physical platforms — Start (far, -Z)
// and Finish/end (near, close to the portal in) — named for their position,
// not their gameplay role: SPAWN_RECT/FINISH_RECT below name which platform
// the tiles/timer treat as the start vs the finish of the course. There are
// two pads, both yellow: EXIT_PAD (spawn platform) pays out and returns to
// island; FINISH_PAD (finish platform) just returns, no payout — see each
// one's comment below. The player's actual SPAWN point, near the bottom of
// this file, is placed beside FINISH_PAD, by request, so it's on the
// opposite platform from EXIT_PAD.

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

// Yellow pad on the finish platform: stepping on it sends the player back
// to the island, with no payout (EXIT_PAD is the one that pays out).
export const FINISH_PAD = { x: 0, z: FINISH_RECT[3] - 8, size: 1.8 }

// Just beside the finish pad, on the finish platform, and outside its
// trigger box (half-size 0.9) so a fresh spawn doesn't bounce straight
// back to the island.
export const SPAWN = { x: FINISH_PAD.x, y: GROUND_Y, z: FINISH_PAD.z+5 }

// Yaw the player (and so the camera, via syncYawToPlayer) faces on spawn —
// 0 looks toward +Z, i.e. back across the tile columns (they sit at
// z -5.5..-18.5, all less negative/"ahead" of SPAWN's z), rather than the
// default Math.PI every other spawn point in the game uses.
export const SPAWN_FACING = 0

export const TIME_LIMIT = 15 // seconds, counted from leaving the spawn platform
export const REWARD_COINS = 200
export const FALL_RESET_Y = GROUND_Y - 12
