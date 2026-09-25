// Skate tier ladder — the buy/equip economy behind the HUD's Skates panel.
// Ported from Ice-Skate's data/hexPowerPad.js + data/skateRack.js's
// RAW_TIERS numbers, but standalone: Ice-Skate ties each tier to a physical
// SkateRack prop you walk up to and press E on; this template has no such
// prop, so the same tiers are bought/equipped directly from a HUD button
// instead (see Hud.jsx's SkatesWindow).
//
// `speedPerGain` becomes the player's speedPerGain on equip (store's
// equipHexPad). `winsRequired` gates buyHexPad. Physical walk speed is fixed
// game-wide (data/progression.js's PLAYER_MOVE_SPEED) and unaffected by tier.
export const HEX_SPEED_PAD_TIERS = [
  { speedPerGain: 1, winsRequired: 0, beamColor: '#ff3b30' },
  { speedPerGain: 2, winsRequired: 1, beamColor: '#ff9500' },
  { speedPerGain: 5, winsRequired: 15, beamColor: '#d1ff1a' },
  { speedPerGain: 25, winsRequired: 50, beamColor: '#4dff1a' },
  { speedPerGain: 50, winsRequired: 250, beamColor: '#1aff70' },
  { speedPerGain: 100, winsRequired: 1200, beamColor: '#1affff' },
  { speedPerGain: 250, winsRequired: 7500, beamColor: '#1a70ff' },
  { speedPerGain: 500, winsRequired: 25000, beamColor: '#701aff' },
  { speedPerGain: 1000, winsRequired: 125000, beamColor: '#d11aff' },
  { speedPerGain: 2000, winsRequired: 250000, beamColor: '#ff1a8c' },
]
