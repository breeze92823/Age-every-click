// Multiplayer / netcode tunables (src/data/* owns every tunable number, same
// convention as data/progression.js/data/bloxity.js). The game is
// single-player-complete: nothing below gates gameplay. The netcode only
// adds the Top Coins / Top Age leaderboard boards (components/
// IslandLandmarks.jsx) plus cross-session save/load for a signed-in player's
// Age/Coins/Rebirth — every path through systems/net.js is built so a slow
// or absent server degrades to solo play, never a stall (same stance as
// systems/bloxity.js).

// Age-every-click-backend (../Age-every-click-backend) deploys to two
// separate Bloxity Legion channels — a `dev` branch push goes to the `dev`
// channel, `main` goes to `prod` — and each channel gets its own hostname
// once deployed. Bloxity gives the running frontend no runtime signal for
// which channel it's serving, so the two server URLs are read from two
// separately-named env vars rather than one, and this project's own
// deploy.yml picks the active one at BUILD time via Vite's `--mode` flag
// (`npm run build:dev` -> `.env.development`/MODE 'development', `npm run
// build` -> MODE 'production'). A local `npm start` in
// Age-every-click-backend listens on ws://localhost:2567 by default (its own
// README), so that's the DEV fallback — zero .env setup needed for local dev
// against a local server.
export const SERVER_URL_DEV = import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567'
// No sane fallback for a real deployed hostname — set VITE_SERVER_URL_MAIN
// (repo variable SERVER_URL_MAIN in this project's own deploy.yml) once the
// game is registered and deployed on Bloxity Legion. Empty means "no prod
// server configured yet"; systems/net.js treats that exactly like an
// unreachable server (stays solo, never throws).
export const SERVER_URL_MAIN = import.meta.env.VITE_SERVER_URL_MAIN || ''

export const SERVER_URL = import.meta.env.MODE === 'production' ? SERVER_URL_MAIN : SERVER_URL_DEV

// Room handler name registered in Age-every-click-backend's src/app.config.ts.
export const ROOM_NAME = 'island'

// One join attempt is abandoned after this long. A cold host normally
// answers well inside this; a dead host never will, and we must not hang on it.
export const JOIN_TIMEOUT_MS = 45_000

// Backoff between connect attempts. The index clamps to the last entry, so
// after a handful of tries it settles at one quiet attempt per 30s forever —
// enough to pick the server back up when it wakes, without hammering it.
export const RETRY_BACKOFF_MS = [3_000, 6_000, 12_000, 20_000, 30_000]

// From attempt #2 onward the HUD banner flips from "connecting" to "server
// is waking up — playing solo meanwhile", because by then a cold start is
// the likely cause and the player should know they can just play.
export const SOLO_NOTICE_AFTER_ATTEMPT = 2

// A mid-game socket drop is ridden out by the @colyseus/sdk Room's own
// reconnection (message buffering + exponential backoff). systems/net.js
// only takes over — dropping to solo and running the retry loop above —
// once that built-in recovery has exhausted its attempts and fires
// room.onLeave.

// Debounce on re-sending our own speed/coins/rebirth after any of them
// change, feeding the two in-world leaderboard boards (Top Coins/Top Age).
// A rapid-clicking player can gain Age many times a second, and a
// leaderboard only needs a roughly-current rank, not a per-click packet.
export const STATS_RESEND_DEBOUNCE_MS = 1_000

// Debounce on re-sending the signed-in player's durable save (server's
// Mongo `players` collection, via IslandRoom.ts's `saveProgress`) — longer
// than STATS_RESEND_DEBOUNCE_MS since this hits Mongo, not just an
// in-memory schema field, and a save a few seconds behind is harmless (the
// next change reschedules it, and teardown() flushes one final time on the
// way out).
export const PROGRESS_RESEND_DEBOUNCE_MS = 3_000

// Wait up to this long for the Bloxity auth state to settle before the
// first connect. This is correctness-critical, not just cosmetic: a signed-in
// player who joins BEFORE auth resolves connects with userId="" (a guest),
// so the server's onJoin has nothing to evict a same-account ghost session
// with (IslandRoom.ts's setUserId()) -- that ghost then sits in room state
// until a LATER `identify` message finally corrects it. Bounded — a
// blocked/absent SDK resolves authState.ready near-instantly anyway
// (bloxity.js init()), so this ceiling only matters for a genuinely slow
// network round-trip.
export const USERNAME_WAIT_MS = 8_000

// How many ranked rows components/IslandLandmarks.jsx's leaderboard boards
// poll for and draw — matches the board texture's originally-authored
// placeholder roster length (data/island.js's old static LEADERBOARDS
// entries), which is what the board art was sized for.
export const LEADERBOARD_VISIBLE_ROWS = 5

// components/IslandLandmarks.jsx's leaderboard boards poll getLeaderboard()
// on this cadence rather than reactively on every store change — an
// actively-clicking player's `speed` changes many times a second, and
// redrawing the board's canvas texture that often would be wasted work for
// a board nobody can read that fast anyway.
export const LEADERBOARD_POLL_MS = 1_000
