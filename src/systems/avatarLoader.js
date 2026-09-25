// Assembles a signed-in player's real Bloxity avatar from the CDN: the base
// rig, each equipped body-part GLB skinned onto its shared skeleton, the
// skin texture, and hat/back .obj accessories clipped to a bone. Framework-
// free (no React) so it can be unit-tested and reused outside components/.
//
// Same rule as systems/bloxity.js: nothing here may throw outward. A blocked
// CDN or a missing/mismatched part is logged and skipped rather than
// crashing the load — components/Player.jsx falls back to the default
// capsule whenever this resolves to null, or for any slot that didn't load.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { TextureLoader, MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { RIG_HEIGHT } from '../data/bloxity.js'
import { player } from './playerState.js'
import {
  baseRigUrl,
  partUrl,
  skinUrl,
  hatObjUrl,
  hatTextureUrl,
  backObjUrl,
  backTextureUrl,
  isEquipped,
} from '../data/avatarCdn.js'

const gltfLoader = new GLTFLoader()
const objLoader = new OBJLoader()
const textureLoader = new TextureLoader()

function loadGltf(url) {
  return new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject))
}
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

// The SDK pre-authors every part GLB against the exact same bone names as
// avatars/player.glb, so attaching one is a name lookup + skinIndex remap,
// not a retarget. Returns false (part skipped) on any bone-name mismatch —
// rendering a part against the wrong indices would warp it silently, which
// is worse than just not showing it.
function attachPartToBaseSkeleton(partMesh, baseSkeleton) {
  const nameToBaseIndex = new Map()
  baseSkeleton.bones.forEach((bone, i) => nameToBaseIndex.set(bone.name, i))

  const partBones = partMesh.skeleton.bones
  const remapped = new Uint16Array(partBones.length)
  for (let i = 0; i < partBones.length; i++) {
    const baseIndex = nameToBaseIndex.get(partBones[i].name)
    if (baseIndex === undefined) return false
    remapped[i] = baseIndex
  }

  const skinIndex = partMesh.geometry.getAttribute('skinIndex')
  const arr = skinIndex.array
  for (let i = 0; i < arr.length; i++) arr[i] = remapped[arr[i]]
  skinIndex.needsUpdate = true

  partMesh.bind(baseSkeleton, partMesh.bindMatrix)
  return true
}

function applySkinTexture(root, texture) {
  texture.flipY = false
  root.traverse((o) => {
    if (!o.isMesh) return
    o.material = new MeshStandardMaterial({ map: texture, ...MATERIAL_PBR.PLAYER })
  })
}

// Loads one hat/back accessory and clips it to the first bone matching
// `boneNamePattern` (best-effort — the SDK's exact hat/back attachment bone
// isn't documented, so this matches on a plausible name rather than a
// confirmed one). Silently no-ops if no matching bone exists.
async function attachAccessory(skeleton, boneNamePattern, objUrl, textureUrl) {
  if (!objUrl) return
  const bone = findBone(skeleton, boneNamePattern)
  if (!bone) return
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

// `equipped` is the shape SDK.avatar.getEquipped() returns: hatId, backId,
// skinId, headId, armLId, armRId, legLId, legRId, torsoId. `signal` (optional
// AbortSignal) lets a caller cancel a stale load (e.g. the player logged out
// or changed avatars again) without racing a slower-to-resolve part onto the
// scene after the fact.
export async function assembleAvatar(equipped, { signal } = {}) {
  if (!equipped) return null

  let baseGltf
  try {
    baseGltf = await loadGltf(baseRigUrl())
  } catch (err) {
    console.warn('[avatarLoader] base rig failed to load', err)
    return null
  }
  if (signal?.aborted) return null

  const root = baseGltf.scene
  // Only the base rig carries animation clips (idle/walk/...) — every part
  // GLB is a static skinned mesh meant to ride the base rig's skeleton, per
  // attachPartToBaseSkeleton above. Stashed on the root (not a real
  // Object3D field, just a convenient carrier) so components/Player.jsx can
  // hand it straight to systems/avatarAnim.js without re-touching the
  // loader. `nodes` is a name -> node lookup of the whole rig (bones
  // included) — avatarAnim.js's generated walk cycle keys ArmL1/ArmR1/
  // LegL1/LegR1/Spine1 by these exact names, per the shared Bloxity rig.
  root.animations = baseGltf.animations || []
  root.nodes = {}
  root.traverse((o) => {
    if (o.name) root.nodes[o.name] = o
  })
  const skeleton = findSkeleton(root)

  if (skeleton) {
    const slots = [
      ['head', equipped.headId],
      ['torso', equipped.torsoId],
      ['armL', equipped.armLId],
      ['armR', equipped.armRId],
      ['legL', equipped.legLId],
      ['legR', equipped.legRId],
    ]
    await Promise.all(
      slots.map(async ([slot, id]) => {
        const url = partUrl(slot, id)
        if (!url) return
        try {
          const gltf = await loadGltf(url)
          if (signal?.aborted) return
          gltf.scene.traverse((o) => {
            if (o.isSkinnedMesh && attachPartToBaseSkeleton(o, skeleton)) root.add(o)
          })
        } catch (err) {
          console.warn(`[avatarLoader] part "${slot}" failed to load`, url, err)
        }
      }),
    )
  }
  if (signal?.aborted) return null

  if (isEquipped(equipped.skinId)) {
    try {
      const texture = await loadTexture(skinUrl(equipped.skinId))
      if (signal?.aborted) return null
      applySkinTexture(root, texture)
    } catch (err) {
      console.warn('[avatarLoader] skin texture failed to load', err)
    }
  }

  if (skeleton) {
    await attachAccessory(skeleton, /head/i, hatObjUrl(equipped.hatId), hatTextureUrl(equipped.hatId))
    if (signal?.aborted) return null
    await attachAccessory(skeleton, /spine|chest|back/i, backObjUrl(equipped.backId), backTextureUrl(equipped.backId))
    if (signal?.aborted) return null
  }

  return root
}

// Rescales an already-assembled avatar per SDK.avatar.getProportions(). Safe
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
