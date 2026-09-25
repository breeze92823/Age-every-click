import { create } from 'zustand'
import {
  SPEED_INITIAL,
  SPEED_MIN,
  SPEED_MAX,
  LEVEL_INITIAL,
  REBIRTH_INITIAL,
  REBIRTH_MIN,
  REBIRTH_MAX,
  WINS_INITIAL,
  WINS_MIN,
  WINS_MAX,
  SPEED_PER_GAIN_INITIAL,
  levelForSpeed,
  canAcceptRebirth,
  clamp,
} from '../data/progression.js'
import { HEX_SPEED_PAD_TIERS } from '../data/hexPowerPad.js'
import { AURA_TIERS, auraStrengthMultiplier } from '../data/aura.js'
import { SHOP_ITEMS } from '../data/shop.js'
import { AGE_MACHINES } from '../data/island.js'

// THE store — durable state + derive() + all actions. No middleware (no
// persist, no immer, no subscribeWithSelector) — ported from Ice-Skate's
// store/useGameStore.js, trimmed of timePlayed/AFK-target fields this
// template has no system for. Since there's no backend here (Ice-Skate
// persists through its Colyseus server), main.jsx wraps this in a plain
// localStorage load/save instead.

// Recomputes every field that is a pure function of another durable field.
// Called at the end of any action that changes speed, so level never has to
// be restated by hand at more than one call site.
function derive(state) {
  return { ...state, level: levelForSpeed(state.speed) }
}

export const useGameStore = create((set, get) => ({
  speed: SPEED_INITIAL,
  level: LEVEL_INITIAL,
  rebirth: REBIRTH_INITIAL,
  wins: WINS_INITIAL,
  speedPerGain: SPEED_PER_GAIN_INITIAL,
  // Tier 0 has winsRequired: 0 and speedPerGain 1 — the free starter tier,
  // owned and equipped from the start.
  ownedHexPads: new Set([0]),
  equippedHexPad: 0,
  ownedAuras: new Set(),
  equippedAura: null,
  // Indices into data/island.js's AGE_MACHINES.tiers that the player has
  // bought. Buying an Age Machine has no other effect yet (see
  // components/hud/Hud.jsx's note that wins/speed have no earn action in
  // this template) — this is ownership only, not a production tick.
  ownedAgeMachines: new Set(),

  // One click's worth of Speed. `multiplier` defaults to 1 (kept for parity
  // with Ice-Skate's walking-tick call site, which passed a treadmill's x2/x3
  // tier there) — speedPerGain * (rebirth + 1) * multiplier * aura strength,
  // floored to a whole number. Returns the Speed actually added after the
  // SPEED_MAX clamp.
  gainSpeed(multiplier = 1) {
    let applied = 0
    set((state) => {
      const mult = multiplier > 0 ? multiplier : 1
      const auraMult = auraStrengthMultiplier(state.equippedAura)
      const gain = Math.floor(state.speedPerGain * (state.rebirth + 1) * mult * auraMult)
      const speed = clamp(state.speed + gain, SPEED_MIN, SPEED_MAX)
      applied = speed - state.speed
      return derive({ ...state, speed })
    })
    return applied
  },

  // Manual, gated by canAcceptRebirth. Re-checks eligibility itself so a
  // duplicate/stale caller can never double-apply a rebirth.
  acceptRebirth() {
    const state = get()
    if (!canAcceptRebirth(state.level, state.rebirth)) return
    set((s) =>
      derive({
        ...s,
        rebirth: clamp(s.rebirth + 1, REBIRTH_MIN, REBIRTH_MAX),
        speed: SPEED_INITIAL,
      }),
    )
  },

  awardWins(amount) {
    if (!(amount > 0)) return
    set((s) => ({ wins: clamp(s.wins + amount, WINS_MIN, WINS_MAX) }))
  },

  // Re-checks ownership and affordability itself so a duplicate/stale caller
  // (or a wins value that has since dropped) can never double-charge,
  // double-apply, or drive wins negative.
  buyHexPad(index) {
    const state = get()
    if (state.ownedHexPads.has(index)) return
    const tier = HEX_SPEED_PAD_TIERS[index]
    if (!tier || state.wins < tier.winsRequired) return
    set((s) => ({ wins: s.wins - tier.winsRequired, ownedHexPads: new Set(s.ownedHexPads).add(index) }))
  },

  equipHexPad(index) {
    const state = get()
    if (!state.ownedHexPads.has(index)) return
    const tier = HEX_SPEED_PAD_TIERS[index]
    if (!tier) return
    set(() => ({
      equippedHexPad: index,
      speedPerGain: tier.speedPerGain,
    }))
  },

  // Called from components/hud/Hud.jsx's AuraEntry wins button. Buying
  // doesn't equip it — the tier just becomes available to equip via
  // equipAuraTier below.
  buyAuraTier(index) {
    const state = get()
    if (state.ownedAuras.has(index)) return
    const tier = AURA_TIERS[index]
    if (!tier || state.wins < tier.winsRequired) return
    set((s) => ({ wins: s.wins - tier.winsRequired, ownedAuras: new Set(s.ownedAuras).add(index) }))
  },

  // Only one aura can be equipped at a time — setting equippedAura to a new
  // index is itself what un-equips whichever tier held it before.
  equipAuraTier(index) {
    const state = get()
    if (!state.ownedAuras.has(index)) return
    set({ equippedAura: index })
  },

  // Clears equippedAura back to null (1x, no aura) — only if the given
  // index is the one currently equipped.
  unequipAuraTier(index) {
    const state = get()
    if (state.equippedAura !== index) return
    set({ equippedAura: null })
  },

  // Called from IslandLandmarks.jsx's per-machine Buy sprite. Re-checks
  // ownership and affordability itself, same guard as buyHexPad/buyAuraTier.
  buyAgeMachine(index) {
    const state = get()
    if (state.ownedAgeMachines.has(index)) return
    const tier = AGE_MACHINES.tiers[index]
    if (!tier || tier.price == null || state.wins < tier.price) return
    set((s) => ({ wins: s.wins - tier.price, ownedAgeMachines: new Set(s.ownedAgeMachines).add(index) }))
  },

  // Called from components/hud/Hud.jsx's ShopItemCard "Buy with Wins"
  // button — the wins-priced alternative to the SKU's (unwired) Bux price.
  buyShopItemWithWins(id) {
    const state = get()
    const item = SHOP_ITEMS.find((i) => i.id === id)
    if (!item || state.wins < item.winsRequired) return
    set((s) => ({ wins: s.wins - item.winsRequired }))
  },

  // Puts every account-scoped field back to the exact defaults a brand-new
  // player starts with.
  resetProgress() {
    set((s) =>
      derive({
        ...s,
        speed: SPEED_INITIAL,
        rebirth: REBIRTH_INITIAL,
        wins: WINS_INITIAL,
        speedPerGain: SPEED_PER_GAIN_INITIAL,
        ownedHexPads: new Set([0]),
        equippedHexPad: 0,
        ownedAuras: new Set(),
        equippedAura: null,
        ownedAgeMachines: new Set(),
      }),
    )
  },

  // Loads a previously-saved snapshot (see systems/persistence.js, this
  // template's localStorage stand-in for Ice-Skate's server save/load).
  // Numbers are re-clamped exactly like every other write path rather than
  // trusted as-is.
  hydrate(saved) {
    if (!saved || typeof saved !== 'object') return
    set((s) => {
      const speed = clamp(Number(saved.speed) || 0, SPEED_MIN, SPEED_MAX)
      const rebirth = clamp(Number(saved.rebirth) || 0, REBIRTH_MIN, REBIRTH_MAX)
      const wins = clamp(Number(saved.wins) || 0, WINS_MIN, WINS_MAX)
      const ownedHexPads = new Set(
        Array.isArray(saved.ownedHexPads) && saved.ownedHexPads.length ? saved.ownedHexPads : [0],
      )
      const equippedHexPad = ownedHexPads.has(saved.equippedHexPad) ? saved.equippedHexPad : 0
      const ownedAuras = new Set(Array.isArray(saved.ownedAuras) ? saved.ownedAuras : [])
      const equippedAura = ownedAuras.has(saved.equippedAura) ? saved.equippedAura : null
      const ownedAgeMachines = new Set(Array.isArray(saved.ownedAgeMachines) ? saved.ownedAgeMachines : [])
      const tier = HEX_SPEED_PAD_TIERS[equippedHexPad]
      return derive({
        ...s,
        speed,
        rebirth,
        wins,
        ownedHexPads,
        equippedHexPad,
        speedPerGain: tier ? tier.speedPerGain : s.speedPerGain,
        ownedAuras,
        equippedAura,
        ownedAgeMachines,
      })
    })
  },
}))
