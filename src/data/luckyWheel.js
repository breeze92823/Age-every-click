// Lucky Wheel (opened with E at the Statue — see systems/statueInteract.js
// and components/hud/LuckyWheel.jsx). Slices are drawn equal-sized and laid
// out clockwise from the top in this array order; `weight` is the % chance
// printed on each slice and is what spinWheel() in the store actually rolls
// against, so the weights must sum to 100. `firstWeight` is the same table for
// an account's very first spin ever (store's wheelSpins === 0): no No Luck and
// no X2 Click Gain, with 200 Age by far the likeliest. Also sums to 100.
export const WHEEL_PRIZES = [
  { id: 'age500', kind: 'age', amount: 500, weight: 15, firstWeight: 15, color: '#f000ff', label: '500 Age' },
  { id: 'coins3000', kind: 'coins', amount: 3000, weight: 10, firstWeight: 10, color: '#00d9ff', label: '3,000' },
  { id: 'ageBoost', kind: 'ageBoost', seconds: 30, weight: 25, firstWeight: 20, color: '#1fe61f', label: 'x2 Age (30s)' },
  { id: 'age200', kind: 'age', amount: 200, weight: 30, firstWeight: 55, color: '#ffdd00', label: '200 Age' },
  { id: 'noLuck', kind: 'noLuck', weight: 15, firstWeight: 0, color: '#9aa3ad', label: 'No Luck' },
  { id: 'speedCoil', kind: 'speedCoil', weight: 5, firstWeight: 0, color: '#ff3d0a', label: 'X2 Click Gain' },
]

// The text printed on each slice, one entry per line — shared by the popup's
// SVG face and the Statue medallion's canvas copy of it.
export const SLICE_LINES = {
  age500: ['500', 'Age'],
  coins3000: ['3,000'],
  ageBoost: ['x2 Age', '(30s)'],
  age200: ['200', 'Age'],
  noLuck: ['No', 'Luck'],
  speedCoil: ['X2 Click', 'Gain'],
}

// New players start with no spins — the first one comes from the free daily
// claim below.
export const SPINS_INITIAL = 0
export const SPINS_MAX = 9999

// One free spin per account per this window. For a signed-in player the
// backend times it on its own clock (server IslandRoom.ts's claimFreeSpin);
// this constant only drives the guest/offline fallback in
// systems/freeSpin.js, and should match the server's FREE_SPIN_INTERVAL_MS.
export const FREE_SPIN_INTERVAL_MS = 24 * 60 * 60 * 1000

// "+1 Spins" price button along the bottom of the wheel.
export const SPIN_PRICE_COINS = 5000

// What Speed Coil does once owned: multiplies every click's Age gain, forever.
export const SPEED_COIL_GAIN_MULTIPLIER = 2
// The coil can only be won by a player with MORE than this many Rebirths, and
// only once. Until then its slice is still drawn but never rolled.
export const SPEED_COIL_MIN_REBIRTH_EXCLUSIVE = 4

export const AGE_BOOST_MULTIPLIER = 2
