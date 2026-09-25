// Clamped frame delta. A backgrounded tab must never dump several seconds
// into one frame.
const MAX_DT = 1 / 15 // ~66ms ceiling

let last = 0

export const timeScale = { paused: false }

// Returns seconds since the previous call, clamped. Returns 0 on the first
// call and whenever paused.
export function tick() {
  const now = performance.now()
  if (last === 0) {
    last = now
    return 0
  }
  let dt = (now - last) / 1000
  last = now
  if (timeScale.paused) return 0
  if (dt > MAX_DT) dt = MAX_DT
  if (dt < 0) dt = 0
  return dt
}

export function resetClock() {
  last = 0
}
