// Portal-owned settings, coerced to usable types — a plain module singleton,
// mutated in place, readable from the frame loop without a subscription. No
// React import — this is a system. Ported verbatim from Ice-Skate's
// systems/settingsState.js.
import { SETTINGS, coerceSetting } from '../data/bloxity.js'

export const settings = {}
for (const key of Object.keys(SETTINGS)) {
  settings[key] = coerceSetting(key, SETTINGS[key].def)
}

const listeners = new Set()

// For the handful of settings that must reach React (fps toggle, panel
// transparency). Frame-loop consumers read `settings` directly instead.
export function subscribe(fn) {
  listeners.add(fn)
  fn(settings)
  return () => listeners.delete(fn)
}

export function setSetting(key, raw) {
  const next = coerceSetting(key, raw)
  if (settings[key] === next) return
  settings[key] = next
  for (const fn of listeners) fn(settings, key)
}
