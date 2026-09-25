// Every tunable constant for the Bloxity (Legion) SDK integration lives
// here — systems/bloxity.js reads this. No SDK constant belongs in a
// component.

// Slug this game is registered under on bloxity.io (https://bloxity.io/g/test-game).
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

// The base rig, measured from the shipped player.glb: origin at the feet,
// 6.4 units tall at bind pose (same shared Bloxity rig the Laser-Escape
// template measured this from). systems/avatarLoader.js's applyProportions
// uses this to convert the rig's native units into the game's metres —
// without it the avatar renders ~3.5x too big next to the capsule fallback
// (player.dims.height is 1.8m).
export const RIG_HEIGHT = 6.4

// --- Locomotion: the walk cycle -----------------------------------------
// The shared Bloxity base rig (static.bloxity.io/avatars/player.glb) is
// R6-style: single-segment limbs (ArmL1/ArmR1/LegL1/LegR1) and a two-node
// spine, no forearm/shin/foot bone to key — a cycle that fits it is a
// four-bone contralateral swing plus a body bob. Numbers ported from the
// Laser-Escape template, which targets this exact same rig and already
// tuned these against it.
//
// If player.glb ships its own clip whose name matches `runClip`,
// systems/avatarAnim.js plays that through an AnimationMixer instead and
// ignores every number below; these only drive the generated fallback.
export const GAIT = {
  runClip: /run|sprint|jog|walk/i, // embedded clip name to prefer, when present
  idleClip: /idle|stand/i, // cross-faded under the run when present
  strideHz: 2.6, // full leg cycles per second at full speed
  legSwing: 0.9, // rad, peak LegL1/LegR1 rotation
  armSwing: 0.55, // rad, peak ArmL1/ArmR1 rotation (opposed to the same-side leg)
  lean: 0.12, // rad, forward pitch of Spine1 at full speed
  bob: 0.06, // m, vertical body bob (two beats per stride)
  swingAxis: 'x', // bone-local axis the limbs swing about
  blendHz: 8, // how fast the cycle eases in/out as speed changes

  // --- Idle: a slow breathing sway when the fallback has nothing else to
  // animate (only reached once the walk cycle's own amp has eased to ~0) ---
  swayAxis: 'z', // bone-local axis for the idle arms' lateral sway
  idleSwayHz: 1.6, // rad/s, the breathing cycle's speed
  idleArmSway: 0.07, // rad, ArmL1/ArmR1's resting lateral offset
  idleArmSwayAmp: 0.03, // rad, extra sway riding on top of the offset
  idleSpineSway: 0.02, // rad, Spine1's breathing tilt
  idleBob: 0.03, // m, vertical body bob while idle

  // --- Airborne: jumping or falling ---------------------------------------
  airborneLegL: -0.55, // rad, LegL1 swept back
  airborneLegR: 0.3, // rad, LegR1 swept forward
  airborneArm: -2.1, // rad, both arms thrown up
  airborneLean: -0.1, // rad, Spine1 leaned back slightly
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
