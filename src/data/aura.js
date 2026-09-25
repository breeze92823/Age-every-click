// Aura tier list shown in the HUD's Aura popup (components/hud/Hud.jsx
// AuraWindow) — one row per tier. Ported verbatim from Ice-Skate's
// data/aura.js.
//
// `iconUrl` points at per-tier art under public/ui/aura/ that doesn't exist
// in this project (or Ice-Skate's) yet — the <img> just renders blank until
// it's dropped in.
export const AURA_TIERS = [
  { name: 'Spark Aura', strengthMult: 1.2, winsRequired: 5, gemCost: 3, iconUrl: '/ui/aura/aura-01.png' },
  { name: 'Ember Aura', strengthMult: 1.35, winsRequired: 25, gemCost: 5, iconUrl: '/ui/aura/aura-02.png' },
  { name: 'Ultra Instinct', strengthMult: 1.6, winsRequired: 100, gemCost: 17, iconUrl: '/ui/aura/aura-03.png' },
  { name: 'Frost Aura', strengthMult: 1.9, winsRequired: 500, gemCost: 25, iconUrl: '/ui/aura/aura-04.png' },
  { name: 'Storm Aura', strengthMult: 2.2, winsRequired: 2500, gemCost: 35, iconUrl: '/ui/aura/aura-05.png' },
  { name: 'Radiant Aura', strengthMult: 2.6, winsRequired: 10000, gemCost: 50, iconUrl: '/ui/aura/aura-06.png' },
  { name: 'Phoenix Aura', strengthMult: 3, winsRequired: 50000, gemCost: 70, iconUrl: '/ui/aura/aura-07.png' },
  { name: 'Void Aura', strengthMult: 3.4, winsRequired: 250000, gemCost: 95, iconUrl: '/ui/aura/aura-08.png' },
  { name: 'Divine Aura', strengthMult: 3.8, winsRequired: 1000000, gemCost: 130, iconUrl: '/ui/aura/aura-09.png' },
  { name: 'Celestial Aura', strengthMult: 4.2, winsRequired: 5000000, gemCost: 175, iconUrl: '/ui/aura/aura-10.png' },
  { name: 'Eternal Aura', strengthMult: 4.5, winsRequired: 15000000, gemCost: 230, iconUrl: '/ui/aura/aura-11.png' },
  { name: 'Omega Aura', strengthMult: 4.8, winsRequired: 50000000, gemCost: 300, iconUrl: '/ui/aura/aura-12.png' },
  { name: 'Transcendent Aura', strengthMult: 5, winsRequired: 100000000, gemCost: 400, iconUrl: '/ui/aura/aura-13.png' },
]

// store/useGameStore.js's gainSpeed() factor for the currently equipped
// aura. `equippedAura` is an index into AURA_TIERS, or null (1x, no-op).
export function auraStrengthMultiplier(equippedAura) {
  const tier = AURA_TIERS[equippedAura]
  return tier ? tier.strengthMult : 1
}
