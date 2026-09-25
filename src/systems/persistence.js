// Local stand-in for Ice-Skate's server save/load (systems/net.js's
// progressPayload/hydrate, sent over its Colyseus connection). This
// template has no backend, so progress just round-trips through
// localStorage instead — same fields, same store.hydrate() entry point.
import { useGameStore } from '../store/useGameStore.js'

const STORAGE_KEY = 'age-every-click:progress'

function snapshot(state) {
  return {
    speed: state.speed,
    rebirth: state.rebirth,
    wins: state.wins,
    ownedHexPads: Array.from(state.ownedHexPads),
    equippedHexPad: state.equippedHexPad,
    ownedAuras: Array.from(state.ownedAuras),
    equippedAura: state.equippedAura,
  }
}

let saveTimer = 0

function scheduleSave() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = 0
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(useGameStore.getState())))
    } catch {
      // Storage full/blocked — progress just won't persist this session.
    }
  }, 500)
}

export function install() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) useGameStore.getState().hydrate(JSON.parse(raw))
  } catch {
    // Corrupt/blocked storage — start fresh rather than throwing.
  }
  useGameStore.subscribe(scheduleSave)
}
