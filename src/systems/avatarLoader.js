// Attaches a signed-in player's equipped Bloxity hat and back accessory (.obj
// files from the CDN) to the game's own default character. Only the
// accessories come from Bloxity: the base rig, body parts and skin are never
// loaded, so the character itself is always the game's (systems/
// defaultCharacter.js). Framework-free (no React) so it can be reused outside
// components/.
//
// Same rule as systems/bloxity.js: nothing here may throw outward. A blocked
// CDN or a failed accessory is logged and skipped, leaving the character bare.
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { TextureLoader, MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { RIG_HEIGHT } from '../data/bloxity.js'
import { player } from './playerState.js'
import { hatObjUrl, hatTextureUrl, backObjUrl, backTextureUrl } from '../data/avatarCdn.js'

const objLoader = new OBJLoader()
const textureLoader = new TextureLoader()

function loadObj(url) {
  return new Promise((resolve, reject) => objLoader.load(url, resolve, undefined, reject))
}
function loadTexture(url) {
  return new Promise((resolve, reject) => textureLoader.load(url, resolve, undefined, reject))
}

function findSkeleton(root) {
  let skeleton = null
  root.traverse((o) => {
    if (!skeleton && o.isSkinnedMesh) skeleton = o.skeleton
  })
  return skeleton
}

function findBone(skeleton, namePattern) {
  return skeleton.bones.find((b) => namePattern.test(b.name)) || null
}

// Loads one hat/back accessory and clips it to `bone` (best-effort — the
// SDK's exact hat/back attachment offset isn't documented, so the model is
// added in the bone's local space as-is). Silently no-ops on a missing bone
// or a failed load.
async function attachAccessory(bone, objUrl, textureUrl) {
  if (!objUrl || !bone) return
  try {
    const obj = await loadObj(objUrl)
    let texture = null
    if (textureUrl) {
      try {
        texture = await loadTexture(textureUrl)
      } catch {
        // Untextured accessory still reads better than skipping it outright.
      }
    }
    obj.traverse((o) => {
      if (!o.isMesh) return
      o.material = texture
        ? new MeshStandardMaterial({ map: texture, ...MATERIAL_PBR.PLAYER })
        : new MeshStandardMaterial({ color: '#cccccc', ...MATERIAL_PBR.PLAYER })
    })
    bone.add(obj)
  } catch (err) {
    console.warn('[avatarLoader] accessory failed to load', objUrl, err)
  }
}

// `equipped` is the shape SDK.avatar.getEquipped() returns; only hatId and
// backId are read. `root` is a character from buildDefaultCharacter(), whose
// `nodes` map holds the head (Neck1) and back (Spine1) bones. `signal`
// (optional AbortSignal) lets a caller cancel a stale load.
export async function attachEquippedAccessories(root, equipped, { signal } = {}) {
  if (!root || !equipped) return
  await attachAccessory(root.nodes?.Neck1, hatObjUrl(equipped.hatId), hatTextureUrl(equipped.hatId))
  if (signal?.aborted) return
  await attachAccessory(root.nodes?.Spine1, backObjUrl(equipped.backId), backTextureUrl(equipped.backId))
}

// Rescales an already-built character per SDK.avatar.getProportions(). Safe
// to call repeatedly (e.g. from onProportionsChanged) since it only mutates
// existing bone transforms, no reload needed.
//
// Only `height`, `headScale`, `neckHeight` and `torsoScaleX` are applied —
// each maps to one bone this codebase can already name with reasonable
// confidence (same head/spine patterns attachAccessory above uses).
// `shoulderWidth`, `armLength` and `legOffsetX` are left untouched: they'd
// need distinguishing the left/right bone of a symmetric pair, and the SDK
// doesn't document that naming convention — guessing wrong would silently
// warp the mesh, which is worse than the slider having no visible effect.
export function applyProportions(root, proportions) {
  if (!root || !proportions) return

  const height = Number.isFinite(proportions.height) ? proportions.height : 1
  // Uniform scale: the rig ships at RIG_HEIGHT units tall (native bind
  // pose), so this both converts it into the game's metres and applies the
  // SDK's height multiplier in one step. A Y-only scale here would leave
  // the rig at its raw ~6.4 units — about 3.5x the capsule's 1.8m — while
  // only stretching it vertically on top of that.
  root.scale.setScalar((player.dims.height / RIG_HEIGHT) * height)

  const skeleton = findSkeleton(root)
  if (!skeleton) return

  const head = findBone(skeleton, /head/i)
  if (head) head.scale.setScalar(Number.isFinite(proportions.headScale) ? proportions.headScale : 1)

  const neck = findBone(skeleton, /neck/i)
  if (neck) neck.scale.y = Number.isFinite(proportions.neckHeight) ? proportions.neckHeight : 1

  const torso = findBone(skeleton, /spine|chest|torso/i)
  if (torso) torso.scale.x = Number.isFinite(proportions.torsoScaleX) ? proportions.torsoScaleX : 1
}
