// Every tunable constant for the Bloxity (Legion) SDK integration lives
// here — systems/bloxity.js reads this. No SDK constant belongs in a
// component.

// TODO: replace with the slug this game is registered under on bloxity.io.
export const GAME_SLUG = 'age-every-click'

// Profile picture shown for a guest (not signed in) or when a signed-in user
// has no `pfp`. components/hud/IdentityChip.jsx's <img> onError falls back
// to an inline silhouette so a blocked CDN never leaves an empty slot.
export const GUEST_PFP_URL = 'https://static.bloxity.io/img/pfps/s0.png?width=128&quality=85&v=2'

// SDK setting keys this template listens for. Registering a listener is
// what makes the control appear in the portal's settings menu, so every key
// here has something behind it (see systems/bloxity.js's applySetting).
export const SETTINGS = {
  master_volume: { def: '80', type: 'number', min: 0, max: 100 },
  music_volume: { def: '80', type: 'number', min: 0, max: 100 },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  fullscreen: { def: 'false', type: 'bool' },
  background_transparency: { def: '0.9', type: 'number', min: 0.2, max: 1 },
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true'
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}
