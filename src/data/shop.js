// Shop tile list shown in the HUD's Shop popup (components/hud/Hud.jsx
// ShopWindow) — one card per SKU, ported from Ice-Skate's data/shop.js.
// Priced in Bux there (systems/bloxity.js's premium balance) with a "Buy
// with Coins" alternate price; buying with Bux needs a server-to-server
// webhook neither project has, so that button stays visual-only.
export const SHOP_ITEMS = [
  { id: 'x2_coins', name: 'x2 Coins', priceBux: 79, coinsRequired: 79000, iconUrl: '/ui/xp_cup.png', featured: true },
  { id: 'vip_laser', name: 'VIP LASER', priceBux: 67, coinsRequired: 67000, iconUrl: null, featured: false },
  { id: 'golden_target', name: 'GOLDEN TARGET', priceBux: 299, coinsRequired: 299000, iconUrl: null, featured: false },
]
