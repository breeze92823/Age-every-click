// Bloxity avatar CDN — asset URL builders for the hat/back .obj accessories
// the game attaches to its own character. Mirrors the path convention the
// Legion SDK's own customizer uses, so an item id resolves to the exact asset
// it would load. Pure string-building only — systems/avatarLoader.js is the
// sole consumer.

const AVATAR_CDN = 'https://static.bloxity.io/avatars'

// The SDK's own "nothing equipped" sentinels — '' / 'undefined' (as literal
// strings) / null for hats/back items — collapsed to one check so callers
// don't need to know which sentinel a given slot uses.
export function isEquipped(id) {
  return id != null && id !== '-1' && id !== -1 && id !== '' && id !== 'undefined'
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
