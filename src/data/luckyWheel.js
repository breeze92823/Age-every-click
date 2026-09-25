// Lucky Wheel (opened with E at the Statue — see systems/statueInteract.js
// and components/hud/LuckyWheel.jsx). Slices are drawn equal-sized and laid
// out clockwise from the top in this array order; `weight` is the % chance
// printed on each slice and is what spinWheel() in the store actually rolls
// against, so the weights must sum to 100.
export const WHEEL_PRIZES = [
  { id: 'age500', kind: 'age', amount: 500, weight: 20, color: '#f000ff', label: '500 Age' },
  { id: 'coins3000', kind: 'coins', amount: 3000, weight: 10, color: '#00d9ff', label: '3,000' },
  { id: 'ageBoost', kind: 'ageBoost', seconds: 30, weight: 30, color: '#1fe61f', label: 'x2 Age (30s)' },
  { id: 'age200', kind: 'age', amount: 200, weight: 35, color: '#ffdd00', label: '200 Age' },
  { id: 'speedCoil', kind: 'speedCoil', weight: 5, color: '#ff3d0a', label: 'X2 Click Gain' },
]

// Free spin every new player starts with, so the wheel is discoverable before
// any coins have been earned.
export const SPINS_INITIAL = 1
export const SPINS_MAX = 9999

// "+1 Spins" price button along the bottom of the wheel.
export const SPIN_PRICE_COINS = 5000

// What Speed Coil does once owned: multiplies every click's Age gain, forever.
export const SPEED_COIL_GAIN_MULTIPLIER = 2
// The coil can only be won by a player with MORE than this many Rebirths, and
// only once. Until then its slice is still drawn but never rolled.
export const SPEED_COIL_MIN_REBIRTH_EXCLUSIVE = 4

export const AGE_BOOST_MULTIPLIER = 2
