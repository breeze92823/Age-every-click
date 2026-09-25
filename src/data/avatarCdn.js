// Bloxity avatar CDN — asset URL builders for the modular avatar system
// (base rig + per-slot body-part GLBs + a shared skin texture + hat/back
// .obj accessories). Mirrors the path convention the Legion SDK's own
// customizer uses, so a part id resolves to the exact asset it would load.
// Pure string-building only — systems/avatarLoader.js is the sole consumer.

const AVATAR_CDN = 'https://static.bloxity.io/avatars'

// slot -> {dir, suffix}. Arms/legs share one directory, split left/right by
// filename suffix; head/torso are singletons.
const PART_SLOTS = {
  head: { dir: 'head', suffix: '' },
  torso: { dir: 'torso', suffix: '' },
  armL: { dir: 'arms', suffix: '_L' },
  armR: { dir: 'arms', suffix: '_R' },
  legL: { dir: 'legs', suffix: '_L' },
  legR: { dir: 'legs', suffix: '_R' },
}

// The SDK's own "nothing equipped" sentinels — '-1' for body parts/skin,
// '' / 'undefined' (as literal strings) / null for hats/back items —
// collapsed to one check so callers don't need to know which sentinel a
// given slot uses.
export function isEquipped(id) {
  return id != null && id !== '-1' && id !== -1 && id !== '' && id !== 'undefined'
}

export function baseRigUrl() {
  return `${AVATAR_CDN}/player.glb`
}

export function partUrl(slot, id) {
  const spec = PART_SLOTS[slot]
  if (!spec || !isEquipped(id)) return null
  return `${AVATAR_CDN}/parts/${spec.dir}/${id}${spec.suffix}.glb`
}

export function skinUrl(id) {
  return isEquipped(id) ? `${AVATAR_CDN}/skins/${id}.png?width=128&quality=85&v=2` : null
}

export function hatObjUrl(id) {
  return isEquipped(id) ? `${AVATAR_CDN}/items/hats/${id}.obj` : null
}

export function hatTextureUrl(id) {
  return isEquipped(id) ? `${AVATAR_CDN}/textures/hats/${id}.png` : null
}

export function backObjUrl(id) {
  return isEquipped(id) ? `${AVATAR_CDN}/items/back/${id}.obj` : null
}

export function backTextureUrl(id) {
  return isEquipped(id) ? `${AVATAR_CDN}/textures/back/${id}.png` : null
}
