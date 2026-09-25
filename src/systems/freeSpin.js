import { FREE_SPIN_INTERVAL_MS } from '../data/luckyWheel.js'

// Local stand-in for the Lucky Wheel's daily free spin, used only when there's
// no account to save it against (a guest, or the server has no Mongo) — a
// signed-in player's cooldown lives on the backend instead (see
// systems/net.js's requestFreeSpin). Just the epoch ms of the last claim in
// localStorage, so like all guest progress it isn't tamper-proof. Every access
// is guarded: storage can be blocked or throw (private windows, sandboxes).
const KEY = 'aec:lastFreeSpinAt'

// Client-clock epoch ms at which the next free spin is available; 0 = now.
export function readLocalFreeSpinReadyAt() {
  try {
    const last = Number(localStorage.getItem(KEY))
    return Number.isFinite(last) && last > 0 ? Math.min(last + FREE_SPIN_INTERVAL_MS, Date.now() + FREE_SPIN_INTERVAL_MS) : 0
  } catch {
    return 0
  }
}

// Same reply shape as the server's `freeSpin` message: { ok, nextInMs }.
export function claimLocalFreeSpin() {
  const remaining = readLocalFreeSpinReadyAt() - Date.now()
  if (remaining > 0) return { ok: false, nextInMs: remaining }
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Storage blocked: the claim still counts for this page load.
  }
  return { ok: true, nextInMs: FREE_SPIN_INTERVAL_MS }
}
