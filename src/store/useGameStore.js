import { create } from 'zustand'
import {
  SPEED_INITIAL,
  SPEED_MIN,
  SPEED_MAX,
  LEVEL_INITIAL,
  REBIRTH_INITIAL,
  REBIRTH_MIN,
  REBIRTH_MAX,
  COINS_INITIAL,
  COINS_MIN,
  COINS_MAX,
  SPEED_PER_GAIN_INITIAL,
  levelForAge,
  canAcceptRebirth,
  clamp,
} from '../data/progression.js'
import { HEX_SPEED_PAD_TIERS } from '../data/hexPowerPad.js'
import { AURA_TIERS, auraStrengthMultiplier } from '../data/aura.js'
import { SHOP_ITEMS } from '../data/shop.js'
import { ALL_AGE_MACHINE_TIERS } from '../data/area2.js'
import { readLocalFreeSpinReadyAt } from '../systems/freeSpin.js'
import {
  WHEEL_PRIZES,
  SPINS_INITIAL,
  SPINS_MAX,
  SPIN_PRICE_COINS,
  SPEED_COIL_GAIN_MULTIPLIER,
  SPEED_COIL_MIN_REBIRTH_EXCLUSIVE,
  AGE_BOOST_MULTIPLIER,
} from '../data/luckyWheel.js'

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
  return { ...state, level: levelForAge(state.speed) }
}

export const useGameStore = create((set, get) => ({
  // Which environment is currently mounted in App.jsx — 'island' (the hub),
  // 'bonus' (through the Impossible Bridge obby pad), 'studJumps' (through
  // the Stud Jumps obby pad), or 'tsunami' (through the Tsunami Escape obby
  // pad). Transient UI state, not durable progress, so persistence.js's
  // snapshot() never includes it and a reload always comes back on the
  // island.
  currentScene: 'island',
  speed: SPEED_INITIAL,
  level: LEVEL_INITIAL,
  rebirth: REBIRTH_INITIAL,
  coins: COINS_INITIAL,
  speedPerGain: SPEED_PER_GAIN_INITIAL,
  // Tier 0 has coinsRequired: 0 and speedPerGain 1 — the free starter tier,
  // owned and equipped from the start.
  ownedHexPads: new Set([0]),
  equippedHexPad: 0,
  ownedAuras: new Set(),
  equippedAura: null,
  // Indices into data/area2.js's ALL_AGE_MACHINE_TIERS (hub, then Area 2) the player has
  // bought.
  ownedAgeMachines: new Set(),

  // Index of the Age Machine the player is currently riding, or null.
  // Transient like currentScene — never persisted, never included in
  // resetProgress — so a reload or a rebirth never leaves the player stuck
  // "inside" a machine. Set by IslandLandmarks.jsx's BuyButton (which also
  // teleports the player onto the machine's stand); cleared by the Return
  // button in Hud.jsx. While set, playerMovement.js freezes all movement and
  // clickGain.js ignores clicks, and GameLoop.jsx's per-frame tickAgeMachine
  // call adds that tier's Age/s to speed.
  ridingAgeMachine: null,

  // Lucky Wheel (opened with E at the Statue). spins and speedCoil (the
  // permanent x2 click gain) are
  // durable; wheelOpen and ageBoostUntil (epoch ms the wheel's x2 Age boost
  // runs out) are transient like ridingAgeMachine. While wheelOpen,
  // playerMovement.js freezes the player.
  spins: SPINS_INITIAL,
  speedCoil: false,
  // How many spins this account has ever done. 0 means the next one is its
  // very first, which rolls the friendlier WHEEL_PRIZES firstWeight table.
  wheelSpins: 0,
  // Client-clock epoch ms when the next free daily spin can be claimed (0 =
  // available now). Durable on the backend for a signed-in player; see
  // requestFreeSpin in systems/net.js.
  freeSpinReadyAt: readLocalFreeSpinReadyAt(),
  wheelOpen: false,
  ageBoostUntil: 0,

  // 'boy' | 'girl' | null. Chosen in components/hud/GenderPicker.jsx at the
  // start of every session; null means "not asked yet" and freezes the player.
  // Deliberately transient: not in net.js's progressPayload(), resetProgress
  // leaves it alone, so it is asked again on each load.
  gender: null,

  setGender(gender) {
    set({ gender })
  },

  openWheel() {
    set({ wheelOpen: true })
  },

  closeWheel() {
    set({ wheelOpen: false })
  },

  // Called from components/hud/LuckyWheel.jsx's coins "+1 Spins" button.
  // Returns whether the purchase went through.
  buySpinWithCoins() {
    const state = get()
    if (state.coins < SPIN_PRICE_COINS || state.spins >= SPINS_MAX) return false
    set((s) => ({ coins: s.coins - SPIN_PRICE_COINS, spins: s.spins + 1 }))
    return true
  },

  // Applies a successful free-spin claim. nextInMs is a duration (not a
  // timestamp) so a wrong client clock can't shift the cooldown.
  grantFreeSpin(nextInMs) {
    set((s) => ({ spins: Math.min(s.spins + 1, SPINS_MAX), freeSpinReadyAt: Date.now() + nextInMs }))
  },

  // A refused claim: just learn how long is really left.
  setFreeSpinCooldown(nextInMs) {
    set({ freeSpinReadyAt: Date.now() + nextInMs })
  },

  // Spends one spin and rolls the prize against the slices' weights. Returns
  // the WHEEL_PRIZES index, or -1 with no spin left. The prize is NOT applied
  // here — the wheel calls claimWheelPrize once its spin animation lands.
  // The Speed Coil slice only counts while the player has more than
  // SPEED_COIL_MIN_REBIRTH_EXCLUSIVE Rebirths and doesn't own it yet; until
  // then its weight is 0, so the other slices' odds just renormalise. An
  // account's very first spin uses each prize's firstWeight instead (no No
  // Luck, no coil, mostly 200 Age).
  spinWheel() {
    const state = get()
    if (state.spins < 1) return -1
    set((s) => ({ spins: s.spins - 1, wheelSpins: s.wheelSpins + 1 }))
    const coilEligible = state.rebirth > SPEED_COIL_MIN_REBIRTH_EXCLUSIVE && !state.speedCoil
    const first = state.wheelSpins === 0
    const weights = WHEEL_PRIZES.map((p) => {
      if (p.kind === 'speedCoil' && !coilEligible) return 0
      return first ? p.firstWeight : p.weight
    })
    let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0)
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]
      if (roll < 0 && weights[i] > 0) return i
    }
    return weights.findLastIndex((w) => w > 0)
  },

  // Applies a rolled prize and returns the text to show the player.
  claimWheelPrize(index) {
    const prize = WHEEL_PRIZES[index]
    if (!prize) return ''
    switch (prize.kind) {
      case 'age':
        set((s) => derive({ ...s, speed: clamp(s.speed + prize.amount, SPEED_MIN, SPEED_MAX) }))
        return `You won ${prize.amount.toLocaleString('en-US')} Age!`
      case 'coins':
        get().awardCoins(prize.amount)
        return `You won ${prize.amount.toLocaleString('en-US')} Coins!`
      case 'ageBoost':
        set((s) => ({ ageBoostUntil: Math.max(Date.now(), s.ageBoostUntil) + prize.seconds * 1000 }))
        return `You won x${AGE_BOOST_MULTIPLIER} Age for ${prize.seconds}s!`
      case 'speedCoil':
        set({ speedCoil: true })
        return `You won x${SPEED_COIL_GAIN_MULTIPLIER} Click Gain forever!`
      case 'noLuck':
        return 'No luck this time!'
      default:
        return ''
    }
  },

  // Called from scenePortals.js's per-frame trigger check.
  setScene(scene) {
    set({ currentScene: scene })
  },

  // One click's worth of Speed. `multiplier` defaults to 1 (kept for parity
  // with Ice-Skate's walking-tick call site, which passed a treadmill's x2/x3
  // tier there) — speedPerGain * (rebirth + 1) * multiplier * aura strength
  // * the Lucky Wheel's x2 boost while active * its permanent Speed Coil
  // x2 once won, floored to a whole number. Returns the Speed actually added after the
  // SPEED_MAX clamp.
  gainSpeed(multiplier = 1) {
    let applied = 0
    set((state) => {
      const mult = multiplier > 0 ? multiplier : 1
      const auraMult = auraStrengthMultiplier(state.equippedAura)
      const boostMult = (Date.now() < state.ageBoostUntil ? AGE_BOOST_MULTIPLIER : 1) * (state.speedCoil ? SPEED_COIL_GAIN_MULTIPLIER : 1)
      const gain = Math.floor(state.speedPerGain * (state.rebirth + 1) * mult * auraMult * boostMult)
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

  awardCoins(amount) {
    if (!(amount > 0)) return
    set((s) => ({ coins: clamp(s.coins + amount, COINS_MIN, COINS_MAX) }))
  },

  // Re-checks ownership and affordability itself so a duplicate/stale caller
  // (or a coins value that has since dropped) can never double-charge,
  // double-apply, or drive coins negative.
  buyHexPad(index) {
    const state = get()
    if (state.ownedHexPads.has(index)) return
    const tier = HEX_SPEED_PAD_TIERS[index]
    if (!tier || state.coins < tier.coinsRequired) return
    set((s) => ({ coins: s.coins - tier.coinsRequired, ownedHexPads: new Set(s.ownedHexPads).add(index) }))
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

  // Called from components/hud/Hud.jsx's AuraEntry coins button. Buying
  // doesn't equip it — the tier just becomes available to equip via
  // equipAuraTier below.
  buyAuraTier(index) {
    const state = get()
    if (state.ownedAuras.has(index)) return
    const tier = AURA_TIERS[index]
    if (!tier || state.coins < tier.coinsRequired) return
    set((s) => ({ coins: s.coins - tier.coinsRequired, ownedAuras: new Set(s.ownedAuras).add(index) }))
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

  // Called from IslandLandmarks.jsx's per-machine Buy button. Re-checks
  // ownership and affordability itself, same guard as buyHexPad/buyAuraTier.
  // Returns whether the purchase went through, so the caller can give the
  // click audible feedback either way (there's no earn loop yet, so most
  // clicks fail affordability — this replaces silent no-ops with a sound).
  buyAgeMachine(index) {
    const state = get()
    if (state.ownedAgeMachines.has(index)) return false
    const tier = ALL_AGE_MACHINE_TIERS[index]
    if (!tier || tier.price == null || state.coins < tier.price) return false
    set((s) => ({ coins: s.coins - tier.price, ownedAgeMachines: new Set(s.ownedAgeMachines).add(index) }))
    return true
  },

  // Called from IslandLandmarks.jsx's BuyButton once a machine is owned.
  // Re-checks ownership itself, same guard pattern as buyAgeMachine — the
  // caller then teleports the player onto the machine's stand only if this
  // returns true.
  enterAgeMachine(index) {
    const state = get()
    if (!state.ownedAgeMachines.has(index)) return false
    set({ ridingAgeMachine: index })
    return true
  },

  // Called from the Return button (Hud.jsx), the only way out once riding.
  exitAgeMachine() {
    set({ ridingAgeMachine: null })
  },

  // Called from GameLoop.jsx every frame with the frame's dt. No-ops unless
  // the player is riding. Adds that tier's Age/s straight to speed —
  // deliberately flat, not run through gainSpeed's rebirth/aura multipliers,
  // since a machine's rate is the number painted on its own TierLabel, not a
  // click.
  tickAgeMachine(dt) {
    const state = get()
    if (state.ridingAgeMachine == null) return
    const tier = ALL_AGE_MACHINE_TIERS[state.ridingAgeMachine]
    if (!tier || !(tier.ageRate > 0)) return
    set((s) => derive({ ...s, speed: clamp(s.speed + tier.ageRate * dt, SPEED_MIN, SPEED_MAX) }))
  },

  // Called from components/hud/Hud.jsx's ShopItemCard "Buy with Coins"
  // button — the coins-priced alternative to the SKU's (unwired) Bux price.
  buyShopItemWithCoins(id) {
    const state = get()
    const item = SHOP_ITEMS.find((i) => i.id === id)
    if (!item || state.coins < item.coinsRequired) return
    set((s) => ({ coins: s.coins - item.coinsRequired }))
  },

  // Puts every account-scoped field back to the exact defaults a brand-new
  // player starts with.
  resetProgress() {
    set((s) =>
      derive({
        ...s,
        speed: SPEED_INITIAL,
        rebirth: REBIRTH_INITIAL,
        coins: COINS_INITIAL,
        speedPerGain: SPEED_PER_GAIN_INITIAL,
        ownedHexPads: new Set([0]),
        equippedHexPad: 0,
        ownedAuras: new Set(),
        equippedAura: null,
        ownedAgeMachines: new Set(),
        spins: SPINS_INITIAL,
        speedCoil: false,
        wheelSpins: 0,
        freeSpinReadyAt: readLocalFreeSpinReadyAt(),
        ageBoostUntil: 0,
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
      const coins = clamp(Number(saved.coins) || 0, COINS_MIN, COINS_MAX)
      const ownedHexPads = new Set(
        Array.isArray(saved.ownedHexPads) && saved.ownedHexPads.length ? saved.ownedHexPads : [0],
      )
      const equippedHexPad = ownedHexPads.has(saved.equippedHexPad) ? saved.equippedHexPad : 0
      const ownedAuras = new Set(Array.isArray(saved.ownedAuras) ? saved.ownedAuras : [])
      const equippedAura = ownedAuras.has(saved.equippedAura) ? saved.equippedAura : null
      const ownedAgeMachines = new Set(Array.isArray(saved.ownedAgeMachines) ? saved.ownedAgeMachines : [])
      const spins = Number.isFinite(saved.spins) ? clamp(Math.floor(saved.spins), 0, SPINS_MAX) : s.spins
      const speedCoil = typeof saved.speedCoil === 'boolean' ? saved.speedCoil : s.speedCoil
      const wheelSpins = Number.isFinite(saved.wheelSpins) ? clamp(Math.floor(saved.wheelSpins), 0, SPINS_MAX) : s.wheelSpins
      // The server sends the cooldown left as a duration (its clock, not ours).
      const freeSpinReadyAt = Number.isFinite(saved.freeSpinInMs)
        ? Date.now() + Math.max(0, saved.freeSpinInMs)
        : s.freeSpinReadyAt
      const tier = HEX_SPEED_PAD_TIERS[equippedHexPad]
      return derive({
        ...s,
        speed,
        rebirth,
        coins,
        ownedHexPads,
        equippedHexPad,
        speedPerGain: tier ? tier.speedPerGain : s.speedPerGain,
        ownedAuras,
        equippedAura,
        ownedAgeMachines,
        spins,
        speedCoil,
        wheelSpins,
        freeSpinReadyAt,
      })
    })
  },
}))
