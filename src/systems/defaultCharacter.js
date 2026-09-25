// The game's own default characters, built procedurally on the same bone
// names and bind positions as the shared Bloxity base rig
// (static.bloxity.io/avatars/player.glb), so systems/avatarAnim.js's
// generated walk cycle (ArmL1/ArmR1/LegL1/LegR1/Spine1) drives them
// unchanged, and they scale by the same RIG_HEIGHT.
//
// Each outfit in OUTFITS dresses the same bare rig:
//   plain   — white figure, jagged white shirt hem over light-blue trousers
//   striped — brown hair, red/white striped tee with a V-neck, jeans, sneakers
//   suit    — swept brown hair, black suit, white shirt, black tie
//   shades  — slicked-back hair, aviators, open black jacket, grey jeans
//   beard   — messy auburn hair, full beard, white tank top, navy jeans
//   grandpa — bald, grey tufts and beard, argyle vest, tan trousers
//   elder   — floor-length white hair and beard, plaid shirt, navy trousers
//   viking  — horned helmet, grey beard, chainmail, leather bracers and boots
//   skeleton — bare bones: skull, ribcage, spine, pelvis and limb bones
//   ghost   — translucent body, grinning head, black claws, a tail for legs
// outfitForLevel() picks the one shown for the player's Age level (plain at level 0
// through ghost at level 9, ghost from then on); DEFAULT_OUTFIT is the fallback.
//
// Each part is a rigid rounded box parented straight to its bone rather than
// a skinned mesh: every part of the base rig is weighted to a single bone
// anyway, so rigid attachment deforms identically and needs no skinning.
// Bones keep identity rotations (the real rig's twisted limb frames only
// matter for its skin weights), so a parent-space X swing is still the
// forward/back flexion axis, as avatarAnim.js assumes.
import {
  Bone,
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { MATERIAL_PBR } from '../data/materials.js'
import { RIG_HEIGHT } from '../data/bloxity.js'
import { player } from './playerState.js'
import { makeStrand } from './hairPhysics.js'

export const DEFAULT_OUTFIT = 'ghost'

const SKIN = '#f7f5fa'
const FACE_INK = '#1b1b1f'

// Part sizes in rig units, read from player.glb's mesh bounds.
const TORSO = [2.8, 2.4, 1.6]
const ARM = [1.2, 2.4, 1.6]
const LEG = [1.4, 2.4, 1.6]
const HEAD = [1.6, 1.6, 1.6]
const SHOE_H = 0.5

// Geometry, textures and materials are built once per outfit and shared by
// every build — the character is rebuilt on each avatar change, so caching
// them avoids leaking GPU resources.
const cache = {}
function cached(key, make) {
  return cache[key] || (cache[key] = make())
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const mat = (opts) => new MeshStandardMaterial({ ...MATERIAL_PBR.PLAYER, ...opts })
const decalMat = (map) => mat({ map, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 })

function stripes(ctx, w, h, count, a, b) {
  const band = h / count
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 ? b : a
    ctx.fillRect(0, i * band, w, band + 1)
  }
}

function faceTexture({ brows = false } = {}) {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = FACE_INK
    for (const x of [98, 158]) {
      ctx.beginPath()
      ctx.ellipse(x, 104, 11, 17, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = FACE_INK
    ctx.lineWidth = 9
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(128, 128, 46, Math.PI * 0.22, Math.PI * 0.78)
    ctx.stroke()
    if (brows) {
      // Short brows angled down toward the nose.
      ctx.lineWidth = 7
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(128 + s * 18, 80)
        ctx.lineTo(128 + s * 44, 72)
        ctx.stroke()
      }
    }
  })
}

// Pieces every outfit shares: the skin-coloured head, arms and torso shapes,
// and the smiley face decal.
function base() {
  return cached('base', () => ({
    torso: new RoundedBoxGeometry(...TORSO, 4, 0.22),
    arm: new RoundedBoxGeometry(...ARM, 4, 0.3),
    leg: new RoundedBoxGeometry(LEG[0], LEG[1] - SHOE_H, LEG[2], 4, 0.2),
    shoe: new RoundedBoxGeometry(LEG[0] + 0.08, SHOE_H + 0.1, LEG[2] + 0.12, 4, 0.22),
    head: new RoundedBoxGeometry(...HEAD, 5, 0.34),
    plane: new PlaneGeometry(1, 1),
    skin: mat({ color: SKIN }),
    face: decalMat(faceTexture()),
  }))
}

function part(geo, material, x, y, z) {
  const m = new Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function decal(material, w, h, x, y, z) {
  const m = new Mesh(base().plane, material)
  m.scale.set(w, h, 1)
  m.position.set(x, y, z)
  return m
}

function bone(name, parent, x, y, z) {
  const b = new Object3D()
  b.name = name
  b.position.set(x, y, z)
  parent.add(b)
  return b
}

// The bare skeleton, bind positions copied from player.glb (parent-relative).
function buildRig(root) {
  const rig = bone('Rig1', root, 0, 0, 0)
  const spine1 = bone('Spine1', rig, 0, 2.4, 0)
  const spine2 = bone('Spine2', spine1, 0, 1.8, 0)
  const armR1 = bone('ArmR1', bone('ArmR_Offset', spine2, -2, 0.6, 0.4), 0, 0, 0)
  const armL1 = bone('ArmL1', bone('ArmL_Offset', spine2, 2, 0.6, 0.4), 0, 0, 0)
  const neck1 = bone('Neck1', bone('Neck_Offset', spine2, 0, 0.6, 0), 0, 0, 0)
  const legR1 = bone('LegR1', bone('LegR_Offset', rig, -0.6, 2.4, 0), 0, 0, 0)
  const legL1 = bone('LegL1', bone('LegL_Offset', rig, 0.6, 2.4, 0), 0, 0, 0)
  return { spine1, neck1, arms: [armR1, armL1], legs: [[legR1, -1], [legL1, 1]], strands: [] }
}

// Anchors in each bone's local space:
// - torso spans y 2.4..4.8, Spine1 sits at 2.4
// - shoulders pivot at (±2, 4.8, 0.4); arms hang to y 2.4, centred on z 0
// - head spans y 4.8..6.4 on the neck at 4.8, face on its +Z (front)
// - hips pivot at (±0.6, 2.4); leg boxes span x 0..±1.4, so centre ±0.7
const TORSO_Y = TORSO[1] / 2
const ARM_Y = -ARM[1] / 2
const ARM_Z = -0.4
const HEAD_Y = HEAD[1] / 2
const LEG_Y = -(LEG[1] - SHOE_H) / 2
const SHOE_Y = -LEG[1] + SHOE_H / 2

function dressHead(bones, face = base().face) {
  const b = base()
  bones.neck1.add(part(b.head, b.skin, 0, HEAD_Y, 0))
  bones.neck1.add(decal(face, HEAD[0], HEAD[1], 0, HEAD_Y, HEAD[2] / 2 + 0.003))
}

// --- plain: white figure, jagged hem over light-blue trousers --------------
function dressPlain(bones) {
  const b = base()
  const m = cached('plain', () => ({
    leg: mat({
      // Trousers with the white shirt hem zig-zagging over their top.
      map: canvasTexture(128, 256, (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, '#a9d2f7')
        grad.addColorStop(1, '#93c2ee')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
        const hem = h * 0.1
        const teeth = 4
        ctx.fillStyle = SKIN
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, hem)
        for (let i = 0; i < teeth; i++) {
          const x0 = (i / teeth) * w
          ctx.lineTo(x0 + w / teeth / 2, hem + h * 0.07)
          ctx.lineTo(x0 + w / teeth, hem)
        }
        ctx.lineTo(w, 0)
        ctx.closePath()
        ctx.fill()
      }),
    }),
    shoe: mat({ color: '#bfe0ff' }),
  }))

  dressHead(bones)
  bones.spine1.add(part(b.torso, b.skin, 0, TORSO_Y, 0))
  for (const arm of bones.arms) arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.leg, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.shoe, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- striped: brown hair, striped V-neck tee, jeans, white sneakers --------
const STRIPE_RED = '#d8261d'
const STRIPE_WHITE = '#f6f4f4'
const HAIR = '#8e3d17'
const HAIR_DARK = '#74300f'
const SLEEVE_H = 0.9

function dressStriped(bones) {
  const b = base()
  const m = cached('striped', () => ({
    // Stripe pitch kept equal on torso and sleeves (2.4 / 12 = 0.9 / 4.5).
    shirt: mat({ map: canvasTexture(64, 256, (ctx, w, h) => stripes(ctx, w, h, 12, STRIPE_RED, STRIPE_WHITE)) }),
    sleeveShirt: mat({ map: canvasTexture(64, 128, (ctx, w, h) => stripes(ctx, w, h, 5, STRIPE_RED, STRIPE_WHITE)) }),
    sleeve: new RoundedBoxGeometry(ARM[0] + 0.12, SLEEVE_H, ARM[2] + 0.12, 4, 0.3),
    collar: decalMat(
      canvasTexture(256, 128, (ctx, w, h) => {
        // A red V-neck trim with skin showing inside it.
        ctx.fillStyle = STRIPE_RED
        ctx.beginPath()
        ctx.moveTo(w * 0.2, 0)
        ctx.lineTo(w * 0.5, h * 0.95)
        ctx.lineTo(w * 0.8, 0)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = SKIN
        ctx.beginPath()
        ctx.moveTo(w * 0.3, 0)
        ctx.lineTo(w * 0.5, h * 0.62)
        ctx.lineTo(w * 0.7, 0)
        ctx.closePath()
        ctx.fill()
      }),
    ),
    jeans: mat({
      map: canvasTexture(64, 256, (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, '#2c5c9a')
        grad.addColorStop(0.5, '#3a6db0')
        grad.addColorStop(1, '#2c5c9a')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }),
    }),
    sneaker: mat({
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#f7f7f7'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#9aa0a8' // sole band
        ctx.fillRect(0, h * 0.78, w, h * 0.22)
      }),
    }),
    hairTop: new RoundedBoxGeometry(HEAD[0] + 0.16, 0.5, HEAD[2] + 0.16, 4, 0.22),
    hairBack: new RoundedBoxGeometry(HEAD[0] + 0.16, 0.95, 0.3, 4, 0.14),
    hairSide: new RoundedBoxGeometry(0.16, 0.55, 1.1, 3, 0.07),
    hairFringe: new RoundedBoxGeometry(HEAD[0] + 0.1, 0.26, 0.22, 3, 0.1),
    hairTuft: new RoundedBoxGeometry(0.55, 0.36, 0.55, 3, 0.16),
    hair: mat({ color: HAIR }),
    hairDark: mat({ color: HAIR_DARK }),
  }))

  dressHead(bones)

  // Hair: a cap over the crown, a back panel, short sides, a front fringe,
  // and a few tilted tufts for the messy top.
  const n = bones.neck1
  const top = HEAD[1]
  n.add(part(m.hairTop, m.hair, 0, top - 0.1, 0))
  n.add(part(m.hairBack, m.hair, 0, top - 0.45, -HEAD[2] / 2 - 0.05))
  for (const s of [-1, 1]) n.add(part(m.hairSide, m.hair, s * (HEAD[0] / 2 + 0.05), top - 0.3, -0.22))
  n.add(part(m.hairFringe, m.hair, 0, top - 0.2, HEAD[2] / 2 + 0.03))
  const tufts = [
    [-0.45, 0.2, 0.3, 0.3],
    [0.4, 0.22, 0.25, -0.35],
    [0, 0.27, -0.05, 0.1],
    [-0.3, 0.2, -0.5, -0.2],
    [0.35, 0.18, -0.45, 0.4],
    [0.05, 0.2, 0.55, -0.15],
  ]
  tufts.forEach(([x, y, z, r], i) => {
    const t = part(m.hairTuft, i % 2 ? m.hairDark : m.hair, x, top + y, z)
    t.rotation.set(r * 0.6, r, -r * 0.5)
    n.add(t)
  })

  // Shirt + collar.
  bones.spine1.add(part(b.torso, m.shirt, 0, TORSO_Y, 0))
  bones.spine1.add(decal(m.collar, 1.1, 0.55, 0, TORSO[1] - 0.275, TORSO[2] / 2 + 0.004))

  // Skin arms under slightly puffed striped short sleeves.
  for (const arm of bones.arms) {
    arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
    arm.add(part(m.sleeve, m.sleeveShirt, 0, -SLEEVE_H / 2 + 0.02, ARM_Z))
  }

  // Jeans + sneakers.
  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.jeans, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.sneaker, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- suit: swept brown hair, black suit, white shirt, black tie -----------
const SUIT = '#141416'
const SUIT_LINE = '#34343a'
const SUIT_HAIR = '#4a2c1c'
const SUIT_HAIR_DARK = '#3a2114'
const CUFF_H = 1.95 // jacket sleeve length; the hand shows below it

function dressSuit(bones) {
  const b = base()
  const m = cached('suit', () => ({
    face: decalMat(faceTexture({ brows: true })),
    suit: mat({ color: SUIT, roughness: 0.55 }),
    shoe: mat({ color: '#0b0b0c', roughness: 0.35 }),
    sleeve: new RoundedBoxGeometry(ARM[0] + 0.1, CUFF_H, ARM[2] + 0.1, 4, 0.3),
    // Jacket front: white shirt V, black tie, lapel edges, hem line, button.
    front: decalMat(
      canvasTexture(256, 220, (ctx, w, h) => {
        const cx = w / 2
        const vBottom = h * 0.5
        ctx.fillStyle = '#f4f4f6'
        ctx.beginPath()
        ctx.moveTo(cx - w * 0.2, 0)
        ctx.lineTo(cx, vBottom)
        ctx.lineTo(cx + w * 0.2, 0)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = SUIT
        ctx.beginPath() // tie knot + blade
        ctx.moveTo(cx - 9, 0)
        ctx.lineTo(cx + 9, 0)
        ctx.lineTo(cx + 6, 16)
        ctx.lineTo(cx + 10, vBottom - 14)
        ctx.lineTo(cx, vBottom)
        ctx.lineTo(cx - 10, vBottom - 14)
        ctx.lineTo(cx - 6, 16)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = SUIT_LINE
        ctx.lineWidth = 4
        ctx.beginPath() // lapels, then the jacket's front edge
        ctx.moveTo(cx - w * 0.2, 0)
        ctx.lineTo(cx - w * 0.27, h * 0.25)
        ctx.lineTo(cx, vBottom + 4)
        ctx.lineTo(cx + w * 0.27, h * 0.25)
        ctx.lineTo(cx + w * 0.2, 0)
        ctx.moveTo(cx, vBottom + 4)
        ctx.lineTo(cx, h)
        ctx.moveTo(0, h - 4)
        ctx.lineTo(w, h - 4)
        ctx.stroke()
        ctx.fillStyle = SUIT_LINE
        ctx.beginPath()
        ctx.arc(cx + 10, h * 0.7, 5, 0, Math.PI * 2)
        ctx.fill()
      }),
    ),
    hairTop: new RoundedBoxGeometry(HEAD[0] + 0.14, 0.42, HEAD[2] + 0.14, 4, 0.2),
    hairBack: new RoundedBoxGeometry(HEAD[0] + 0.14, 0.85, 0.26, 4, 0.12),
    hairSide: new RoundedBoxGeometry(0.14, 0.5, 1.2, 3, 0.06),
    hairQuiff: new RoundedBoxGeometry(HEAD[0] + 0.08, 0.42, 0.7, 4, 0.2),
    hairSweep: new RoundedBoxGeometry(0.9, 0.3, 1.2, 3, 0.14),
    hair: mat({ color: SUIT_HAIR }),
    hairDark: mat({ color: SUIT_HAIR_DARK }),
  }))

  dressHead(bones, m.face)

  // Hair: short back and sides, a raised front quiff swept to one side.
  const n = bones.neck1
  const top = HEAD[1]
  n.add(part(m.hairTop, m.hair, 0, top - 0.06, 0))
  n.add(part(m.hairBack, m.hair, 0, top - 0.42, -HEAD[2] / 2 - 0.04))
  for (const s of [-1, 1]) n.add(part(m.hairSide, m.hair, s * (HEAD[0] / 2 + 0.04), top - 0.25, -0.2))
  const quiff = part(m.hairQuiff, m.hair, 0, top + 0.12, HEAD[2] / 2 - 0.3)
  quiff.rotation.set(-0.35, 0, 0.06)
  n.add(quiff)
  for (const [x, z, r] of [[-0.35, -0.1, 0.18], [0.4, -0.2, -0.22]]) {
    const sweep = part(m.hairSweep, m.hairDark, x, top + 0.16, z)
    sweep.rotation.set(-0.1, r, r)
    n.add(sweep)
  }

  // Jacket + shirt front.
  bones.spine1.add(part(b.torso, m.suit, 0, TORSO_Y, 0))
  bones.spine1.add(decal(m.front, TORSO[0], TORSO[1] - 0.05, 0, TORSO_Y, TORSO[2] / 2 + 0.004))

  // Skin arms under long jacket sleeves, hands showing below the cuff.
  for (const arm of bones.arms) {
    arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
    arm.add(part(m.sleeve, m.suit, 0, -CUFF_H / 2 + 0.03, ARM_Z))
  }

  // Trousers + polished shoes.
  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.suit, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.shoe, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- shades: slicked-back hair, aviators, open black jacket, grey jeans ----
const JACKET = '#1d1d20'
const JACKET_LIGHT = '#2c2c31'
const TEE = '#f4f4f6'

// Fine vertical grain so a flat dark colour reads as denim/leather.
function grain(ctx, w, h, base, streak, count) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = streak
  for (let i = 0; i < count; i++) {
    const x = (i * 37) % w
    ctx.fillRect(x, 0, 1 + (i % 2), h)
  }
}

function dressShades(bones) {
  const b = base()
  const m = cached('shades', () => ({
    jacket: mat({
      roughness: 0.45,
      map: canvasTexture(128, 128, (ctx, w, h) => grain(ctx, w, h, JACKET, JACKET_LIGHT, 14)),
    }),
    // Open jacket front: tee showing down the middle, button rows, chest
    // pockets and the waistband.
    front: decalMat(
      canvasTexture(256, 220, (ctx, w, h) => {
        const cx = w / 2
        const tee = w * 0.2
        ctx.fillStyle = TEE
        ctx.fillRect(cx - tee / 2, 0, tee, h)
        ctx.strokeStyle = '#46464d'
        ctx.lineWidth = 3
        ctx.strokeRect(cx - tee / 2 - 34, h * 0.18, 26, 22) // pocket flaps
        ctx.strokeRect(cx + tee / 2 + 8, h * 0.18, 26, 22)
        ctx.fillStyle = '#6a6a72'
        for (let y = 20; y < h * 0.84; y += 18) {
          ctx.fillRect(cx - tee / 2 - 8, y, 4, 4)
          ctx.fillRect(cx + tee / 2 + 4, y, 4, 4)
        }
        ctx.fillStyle = JACKET_LIGHT // waistband
        ctx.fillRect(0, h * 0.86, cx - tee / 2, h * 0.1)
        ctx.fillRect(cx + tee / 2, h * 0.86, cx - tee / 2, h * 0.1)
      }),
    ),
    // Long sleeve with an elbow seam and a slightly lighter forearm.
    sleeveMat: mat({
      roughness: 0.4,
      map: canvasTexture(64, 128, (ctx, w, h) => {
        grain(ctx, w, h, JACKET, JACKET_LIGHT, 8)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(0, h * 0.52, w, h * 0.48)
        ctx.fillStyle = '#0e0e10'
        ctx.fillRect(0, h * 0.5, w, 3)
      }),
    }),
    sleeve: new RoundedBoxGeometry(ARM[0] + 0.1, CUFF_H, ARM[2] + 0.1, 4, 0.3),
    // Washed grey jeans: vertical fade streaks and a lighter knee band.
    jeans: mat({
      map: canvasTexture(64, 256, (ctx, w, h) => {
        grain(ctx, w, h, '#4c4c53', '#5e5e66', 10)
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(0, h * 0.5, w, h * 0.16)
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.fillRect(0, h * 0.85, w, h * 0.15)
      }),
    }),
    sneaker: mat({
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#d9dbe0'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#4b4d54'
        ctx.fillRect(0, h * 0.35, w, h * 0.12) // side stripe
        ctx.fillStyle = '#f5f5f7'
        ctx.fillRect(0, h * 0.78, w, h * 0.22) // sole
      }),
    }),
    // Aviators: two dark glossy lenses on a thin silver top bar.
    lens: new RoundedBoxGeometry(0.66, 0.42, 0.08, 3, 0.03),
    bar: new RoundedBoxGeometry(1.5, 0.06, 0.06, 2, 0.02),
    lensMat: mat({ color: '#15151a', roughness: 0.15, metalness: 0.4 }),
    frameMat: mat({ color: '#c9ccd2', roughness: 0.3, metalness: 0.8 }),
    // Slicked-back hair with lighter streaks running front to back.
    hair: mat({
      map: canvasTexture(128, 128, (ctx, w, h) => grain(ctx, w, h, '#553522', '#7c5536', 12)),
    }),
    hairTop: new RoundedBoxGeometry(HEAD[0] + 0.14, 0.46, HEAD[2] + 0.14, 4, 0.2),
    hairBack: new RoundedBoxGeometry(HEAD[0] + 0.14, 0.8, 0.26, 4, 0.12),
    hairSide: new RoundedBoxGeometry(0.14, 0.45, 1.2, 3, 0.06),
    hairPomp: new RoundedBoxGeometry(HEAD[0] - 0.1, 0.5, 1.3, 4, 0.24),
  }))

  dressHead(bones)

  const n = bones.neck1
  const top = HEAD[1]
  n.add(part(m.hairTop, m.hair, 0, top - 0.08, 0))
  n.add(part(m.hairBack, m.hair, 0, top - 0.42, -HEAD[2] / 2 - 0.04))
  for (const s of [-1, 1]) n.add(part(m.hairSide, m.hair, s * (HEAD[0] / 2 + 0.04), top - 0.22, -0.2))
  const pomp = part(m.hairPomp, m.hair, 0, top + 0.2, 0.12)
  pomp.rotation.x = 0.22 // swept up at the front, back toward the crown
  n.add(pomp)

  // Glasses sit over the face decal's eyes (head-local y ≈ 0.95).
  const eyeY = 0.97
  const faceZ = HEAD[2] / 2 + 0.05
  for (const s of [-1, 1]) {
    const lens = part(m.lens, m.lensMat, s * 0.36, eyeY, faceZ)
    lens.rotation.z = s * -0.08
    n.add(lens)
  }
  n.add(part(m.bar, m.frameMat, 0, eyeY + 0.2, faceZ + 0.01))

  // Jacket over the tee.
  bones.spine1.add(part(b.torso, m.jacket, 0, TORSO_Y, 0))
  bones.spine1.add(decal(m.front, TORSO[0], TORSO[1] - 0.05, 0, TORSO_Y, TORSO[2] / 2 + 0.004))

  for (const arm of bones.arms) {
    arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
    arm.add(part(m.sleeve, m.sleeveMat, 0, -CUFF_H / 2 + 0.03, ARM_Z))
  }

  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.jeans, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.sneaker, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- beard: messy auburn hair, full beard, white tank top, navy jeans -----
const BEARD = '#5a2f1a'
const BEARD_LIGHT = '#74412a'

// Eyes, stern brows, and a full beard + moustache framing an open smile.
// Drawn opaque over the lower face; beardSide/beardChin give it volume.
function beardFaceTexture({ beard = BEARD, light = BEARD_LIGHT, stache = '#4a2514', brows = true } = {}) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = FACE_INK
    for (const x of [100, 156]) {
      ctx.beginPath()
      ctx.ellipse(x, 100, 9, 13, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = FACE_INK
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    if (brows) {
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(128 + s * 16, 82)
        ctx.lineTo(128 + s * 44, 72)
        ctx.stroke()
      }
    }

    // Beard: full-width below the cheeks, running up the sides as sideburns.
    ctx.fillStyle = beard
    ctx.beginPath()
    ctx.moveTo(0, 60)
    ctx.lineTo(26, 60)
    ctx.quadraticCurveTo(40, 150, 128, 138)
    ctx.quadraticCurveTo(216, 150, 230, 60)
    ctx.lineTo(w, 60)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = light // fur texture
    ctx.lineWidth = 2
    for (let i = 0; i < 60; i++) {
      const x = (i * 53) % w
      const y = 130 + ((i * 29) % 120)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 3, y + 10)
      ctx.stroke()
    }
    // Moustache.
    ctx.fillStyle = stache
    ctx.beginPath()
    ctx.ellipse(128, 150, 62, 16, 0, 0, Math.PI * 2)
    ctx.fill()
    // Open smile.
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(90, 162)
    ctx.quadraticCurveTo(128, 222, 166, 162)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = FACE_INK
    ctx.lineWidth = 6
    ctx.stroke()
  })
}

function dressBeard(bones) {
  const b = base()
  const m = cached('beard', () => ({
    face: decalMat(beardFaceTexture()),
    beard: mat({ map: canvasTexture(64, 64, (ctx, w, h) => grain(ctx, w, h, BEARD, BEARD_LIGHT, 10)) }),
    beardSide: new RoundedBoxGeometry(0.14, 0.95, 1.1, 3, 0.06),
    beardChin: new RoundedBoxGeometry(1.5, 0.4, 0.3, 3, 0.14),
    hair: mat({ map: canvasTexture(128, 128, (ctx, w, h) => grain(ctx, w, h, '#9a5a2e', '#b8773f', 14)) }),
    hairTop: new RoundedBoxGeometry(HEAD[0] + 0.18, 0.52, HEAD[2] + 0.18, 4, 0.24),
    hairBack: new RoundedBoxGeometry(HEAD[0] + 0.18, 1.05, 0.3, 4, 0.14),
    hairSide: new RoundedBoxGeometry(0.16, 0.6, 1.2, 3, 0.07),
    hairFringe: new RoundedBoxGeometry(1.25, 0.34, 0.26, 3, 0.13),
    // Tank top: scoop neck, straps and a hem, over a plain white torso.
    tank: mat({ color: '#fdfdfe' }),
    tankFront: decalMat(
      canvasTexture(256, 220, (ctx, w, h) => {
        const cx = w / 2
        ctx.strokeStyle = '#d4d4de'
        ctx.lineWidth = 4
        ctx.beginPath() // scoop neckline between the straps
        ctx.moveTo(cx - 70, 0)
        ctx.quadraticCurveTo(cx - 60, 60, cx, 62)
        ctx.quadraticCurveTo(cx + 60, 60, cx + 70, 0)
        ctx.moveTo(cx - 70, 0) // strap edges
        ctx.lineTo(cx - 100, 0)
        ctx.moveTo(cx - 96, 0)
        ctx.quadraticCurveTo(cx - 100, 50, cx - 128, 60)
        ctx.moveTo(cx + 96, 0)
        ctx.quadraticCurveTo(cx + 100, 50, cx + 128, 60)
        ctx.moveTo(0, h - 22) // hem
        ctx.lineTo(w, h - 22)
        ctx.stroke()
        ctx.fillStyle = SKIN // skin inside the scoop
        ctx.beginPath()
        ctx.moveTo(cx - 68, 0)
        ctx.quadraticCurveTo(cx - 58, 58, cx, 60)
        ctx.quadraticCurveTo(cx + 58, 58, cx + 68, 0)
        ctx.closePath()
        ctx.fill()
      }),
    ),
    // Dark navy jeans with a faded knee band.
    jeans: mat({
      map: canvasTexture(64, 256, (ctx, w, h) => {
        grain(ctx, w, h, '#1f2a48', '#2e3b5e', 10)
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(0, h * 0.5, w, h * 0.14)
      }),
    }),
    shoe: mat({
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#2a2a30'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#cfcfd8'
        ctx.fillRect(0, h * 0.8, w, h * 0.2) // sole
      }),
    }),
  }))

  dressHead(bones, m.face)

  // Beard volume: sideburns down both cheeks and a chin block.
  const n = bones.neck1
  const top = HEAD[1]
  for (const s of [-1, 1]) n.add(part(m.beardSide, m.beard, s * (HEAD[0] / 2 + 0.04), 0.5, 0.2))
  n.add(part(m.beardChin, m.beard, 0, 0.14, HEAD[2] / 2 - 0.06))

  // Hair: shaggy cap, long back and sides, a fringe swept across the brow.
  n.add(part(m.hairTop, m.hair, 0, top - 0.06, 0))
  n.add(part(m.hairBack, m.hair, 0, top - 0.5, -HEAD[2] / 2 - 0.05))
  for (const s of [-1, 1]) n.add(part(m.hairSide, m.hair, s * (HEAD[0] / 2 + 0.05), top - 0.32, -0.2))
  const fringe = part(m.hairFringe, m.hair, 0.12, top - 0.2, HEAD[2] / 2 + 0.05)
  fringe.rotation.z = -0.2
  n.add(fringe)

  // Tank top; bare arms.
  bones.spine1.add(part(b.torso, m.tank, 0, TORSO_Y, 0))
  bones.spine1.add(decal(m.tankFront, TORSO[0], TORSO[1] - 0.05, 0, TORSO_Y, TORSO[2] / 2 + 0.004))
  for (const arm of bones.arms) arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))

  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.jeans, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.shoe, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- grandpa: bald, grey tufts + beard, argyle vest, tan trousers --------
const GREY = '#a9a9b3'
const GREY_LIGHT = '#d2d2da'
const SHIRT = '#eeeaf4'

function dressGrandpa(bones) {
  const b = base()
  const m = cached('grandpa', () => ({
    face: decalMat(beardFaceTexture({ beard: GREY, light: GREY_LIGHT, stache: '#8e8e99', brows: false })),
    grey: mat({ map: canvasTexture(64, 64, (ctx, w, h) => grain(ctx, w, h, GREY, GREY_LIGHT, 10)) }),
    beardSide: new RoundedBoxGeometry(0.14, 0.95, 1.1, 3, 0.06),
    beardChin: new RoundedBoxGeometry(1.5, 0.36, 0.28, 3, 0.13),
    tuftSide: new RoundedBoxGeometry(0.26, 0.6, 1.3, 3, 0.12),
    tuftBack: new RoundedBoxGeometry(HEAD[0] + 0.2, 0.55, 0.28, 3, 0.13),
    tuftPuff: new RoundedBoxGeometry(0.34, 0.36, 0.5, 3, 0.15),
    // Argyle knit: alternating dark/orange-brown diamonds on a mid brown,
    // crossed by thin light diagonals offset half a diamond.
    vest: mat({
      map: canvasTexture(256, 256, (ctx, w, h) => {
        const cols = 4
        const rows = 4
        const dw = w / cols
        const dh = h / rows
        ctx.fillStyle = '#8a4f2c'
        ctx.fillRect(0, 0, w, h)
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const cx = (i + 0.5) * dw
            const cy = (j + 0.5) * dh
            ctx.fillStyle = (i + j) % 2 ? '#2b1a13' : '#b3703f'
            ctx.beginPath()
            ctx.moveTo(cx, cy - dh / 2)
            ctx.lineTo(cx + dw / 2, cy)
            ctx.lineTo(cx, cy + dh / 2)
            ctx.lineTo(cx - dw / 2, cy)
            ctx.closePath()
            ctx.fill()
          }
        }
        ctx.strokeStyle = 'rgba(232,205,175,0.7)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let k = -cols; k <= cols * 2; k++) {
          const x = k * dw
          ctx.moveTo(x, 0)
          ctx.lineTo(x + w * (dw / dh), h)
          ctx.moveTo(x, 0)
          ctx.lineTo(x - w * (dw / dh), h)
        }
        ctx.stroke()
      }),
    }),
    // White shirt V-neck with a collar, and the vest's ribbed hem.
    vestFront: decalMat(
      canvasTexture(256, 220, (ctx, w, h) => {
        const cx = w / 2
        ctx.fillStyle = SHIRT
        ctx.beginPath()
        ctx.moveTo(cx - w * 0.24, 0)
        ctx.lineTo(cx, h * 0.45)
        ctx.lineTo(cx + w * 0.24, 0)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#5a3420' // ribbed V trim
        ctx.lineWidth = 7
        ctx.beginPath()
        ctx.moveTo(cx - w * 0.24, 0)
        ctx.lineTo(cx, h * 0.45)
        ctx.lineTo(cx + w * 0.24, 0)
        ctx.stroke()
        ctx.strokeStyle = '#cfcad8' // shirt collar
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(cx - 30, 0)
        ctx.lineTo(cx, 26)
        ctx.lineTo(cx + 30, 0)
        ctx.stroke()
        ctx.fillStyle = '#6b3d24' // ribbed hem
        ctx.fillRect(0, h * 0.88, w, h * 0.12)
        ctx.fillStyle = '#5a3420'
        for (let x = 0; x < w; x += 8) ctx.fillRect(x, h * 0.88, 3, h * 0.12)
      }),
    ),
    // Long white shirt sleeves with a cuff band above the hand.
    sleeveMat: mat({
      map: canvasTexture(64, 128, (ctx, w, h) => {
        grain(ctx, w, h, SHIRT, '#e2dcea', 8)
        ctx.fillStyle = '#d6d0e0'
        ctx.fillRect(0, h * 0.86, w, 3)
      }),
    }),
    sleeve: new RoundedBoxGeometry(ARM[0] + 0.08, CUFF_H, ARM[2] + 0.08, 4, 0.3),
    // Tan trousers with a lighter knee crease.
    pants: mat({
      map: canvasTexture(64, 256, (ctx, w, h) => {
        grain(ctx, w, h, '#86695d', '#937669', 8)
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(0, h * 0.5, w, h * 0.06)
        ctx.fillStyle = 'rgba(0,0,0,0.12)'
        ctx.fillRect(0, h * 0.56, w, h * 0.03)
      }),
    }),
    shoe: mat({
      roughness: 0.4,
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#3b2a22'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#1f1612'
        ctx.fillRect(0, h * 0.8, w, h * 0.2) // sole
      }),
    }),
  }))

  dressHead(bones, m.face)

  // Bald on top: grey tufts over the ears and round the back only.
  const n = bones.neck1
  const top = HEAD[1]
  for (const s of [-1, 1]) {
    n.add(part(m.tuftSide, m.grey, s * (HEAD[0] / 2 + 0.06), top - 0.5, -0.12))
    const puff = part(m.tuftPuff, m.grey, s * (HEAD[0] / 2 + 0.1), top - 0.25, 0.1)
    puff.rotation.z = s * 0.3
    n.add(puff)
  }
  n.add(part(m.tuftBack, m.grey, 0, top - 0.6, -HEAD[2] / 2 - 0.06))

  // Beard volume.
  for (const s of [-1, 1]) n.add(part(m.beardSide, m.grey, s * (HEAD[0] / 2 + 0.04), 0.5, 0.2))
  n.add(part(m.beardChin, m.grey, 0, 0.14, HEAD[2] / 2 - 0.06))

  // Argyle vest over a long-sleeved shirt.
  bones.spine1.add(part(b.torso, m.vest, 0, TORSO_Y, 0))
  bones.spine1.add(decal(m.vestFront, TORSO[0], TORSO[1] - 0.05, 0, TORSO_Y, TORSO[2] / 2 + 0.004))
  for (const arm of bones.arms) {
    arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
    arm.add(part(m.sleeve, m.sleeveMat, 0, -CUFF_H / 2 + 0.03, ARM_Z))
  }

  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.pants, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.shoe, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- elder: floor-length white hair and beard, plaid shirt, navy trousers --
const WHITE_HAIR = '#f1eff7'
const WHITE_HAIR_STREAK = '#d9d5e6'

// A rounded box hung from its top edge (local y 0 down to -len) that tapers
// toward the tip and bends along Z as it goes — how the long beard and hair
// flare away from the body at the bottom (see the side view).
function hangingStrand(width, len, depth, { tipX = 0.4, tipZ = 0.6, bend = 0 } = {}) {
  const geo = new RoundedBoxGeometry(width, len, depth, 6, Math.min(width, depth) * 0.45)
  geo.translate(0, -len / 2, 0)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getY(i) / len // 0 at the top, 1 at the tip
    pos.setX(i, pos.getX(i) * (1 - (1 - tipX) * t))
    pos.setZ(i, pos.getZ(i) * (1 - (1 - tipZ) * t) + bend * t * t)
  }
  geo.computeVertexNormals()
  geo.userData.strand = { len, bend }
  return geo
}

// Rigs a hangingStrand geometry for systems/hairPhysics.js: `segs` bone
// segments down its centreline, each vertex weighted between the two joints
// it sits between so the strand bends smoothly. Stores the joint positions
// (strand-local) on the geometry for hairStrand() below.
function skinStrand(geo, segs) {
  const { len, bend } = geo.userData.strand
  const pos = geo.attributes.position
  const idx = new Uint16Array(pos.count * 4)
  const wt = new Float32Array(pos.count * 4)
  for (let i = 0; i < pos.count; i++) {
    const f = Math.min(Math.max(-pos.getY(i) / len, 0), 1) * segs
    const j = Math.min(Math.floor(f), segs - 1)
    idx[i * 4] = j
    idx[i * 4 + 1] = j + 1
    wt[i * 4] = 1 - (f - j)
    wt[i * 4 + 1] = f - j
  }
  geo.setAttribute('skinIndex', new BufferAttribute(idx, 4))
  geo.setAttribute('skinWeight', new BufferAttribute(wt, 4))
  geo.userData.joints = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    geo.userData.joints.push(new Vector3(0, -len * t, bend * t * t))
  }
  return geo
}

// Hangs a skinned strand (from skinStrand) off `parent` at (x, y, z) on a
// fresh bone chain, and queues it for binding + physics in
// buildDefaultCharacter(). side/body: see hairPhysics.js's makeStrand().
function hairStrand(bones, parent, geo, material, x, y, z, side, body) {
  const joints = geo.userData.joints
  const chain = []
  let prev = parent
  joints.forEach((p, i) => {
    const b = new Bone()
    b.name = `Hair${bones.strands.length}_${i}`
    if (i === 0) b.position.set(x, y, z)
    else b.position.subVectors(p, joints[i - 1])
    prev.add(b)
    chain.push(b)
    prev = b
  })
  const mesh = new SkinnedMesh(geo, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false // it swings outside its bind-pose bounds
  parent.add(mesh)
  const rest = joints.map((p) => new Vector3(x, y, z).add(p))
  bones.strands.push({ mesh, chain, rest, side, body })
}

function plaid(ctx, w, h, base, dark, light, step) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = dark
  for (let p = 0; p < Math.max(w, h); p += step) {
    ctx.fillRect(p, 0, step * 0.18, h)
    ctx.fillRect(0, p, w, step * 0.18)
  }
  ctx.fillStyle = light
  for (let p = step / 2; p < Math.max(w, h); p += step) {
    ctx.fillRect(p, 0, 1, h)
    ctx.fillRect(0, p, w, 1)
  }
}

function dressElder(bones) {
  const b = base()
  const m = cached('elder', () => ({
    white: mat({ map: canvasTexture(64, 128, (ctx, w, h) => grain(ctx, w, h, WHITE_HAIR, WHITE_HAIR_STREAK, 12)) }),
    // Beard hangs from under the smile to just above the shoes, curling
    // forward; the hair falls down the back and curls away behind.
    beard: skinStrand(hangingStrand(1.6, 4.5, 0.55, { tipX: 0.45, tipZ: 0.5, bend: 0.7 }), 8),
    hairBack: skinStrand(hangingStrand(HEAD[0] + 0.2, 6.1, 0.42, { tipX: 0.45, tipZ: 0.6, bend: -0.9 }), 10),
    hairTop: new RoundedBoxGeometry(HEAD[0] + 0.2, 0.5, HEAD[2] + 0.2, 4, 0.24),
    hairSide: hangingStrand(0.2, 1.9, 1.3, { tipX: 0.8, tipZ: 0.7 }),
    beardSide: new RoundedBoxGeometry(0.16, 0.7, 1.0, 3, 0.07),
    brow: new RoundedBoxGeometry(0.46, 0.16, 0.14, 3, 0.06),
    stache: new RoundedBoxGeometry(0.62, 0.2, 0.18, 3, 0.08),
    shirt: mat({ map: canvasTexture(128, 128, (ctx, w, h) => plaid(ctx, w, h, '#5b3424', '#3f2218', '#8a5a40', 32)) }),
    sleeve: new RoundedBoxGeometry(ARM[0] + 0.08, CUFF_H, ARM[2] + 0.08, 4, 0.3),
    pants: mat({ map: canvasTexture(64, 256, (ctx, w, h) => grain(ctx, w, h, '#1e2741', '#2a3556', 10)) }),
    shoe: mat({
      roughness: 0.45,
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#5e3b24'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#3a2416'
        ctx.fillRect(0, h * 0.8, w, h * 0.2) // sole
      }),
    }),
  }))

  // The standard face: its eyes sit at head-local y ≈ 0.95 and the smile at
  // ≈ 0.5–0.62, so the brows go above, the moustache between, and the beard
  // starts just under the smile.
  dressHead(bones)
  const n = bones.neck1
  const top = HEAD[1]
  const front = HEAD[2] / 2
  for (const s of [-1, 1]) {
    const brow = part(m.brow, m.white, s * 0.36, 1.13, front + 0.05)
    brow.rotation.z = s * 0.12
    n.add(brow)
    const stache = part(m.stache, m.white, s * 0.28, 0.72, front + 0.07)
    stache.rotation.z = s * -0.28 // droops toward the corners
    n.add(stache)
    n.add(part(m.beardSide, m.white, s * (HEAD[0] / 2 + 0.05), 0.4, 0.2))
    n.add(part(m.hairSide, m.white, s * (HEAD[0] / 2 + 0.08), top + 0.05, -0.1))
  }
  // The long beard and back hair swing with hairPhysics.js; each is kept
  // just clear of the chest / back (torso half-depth 0.8 + strand half-depth).
  hairStrand(bones, n, m.beard, m.white, 0, 0.46, front + 0.2, 1, 1.0)
  n.add(part(m.hairTop, m.white, 0, top - 0.06, 0))
  hairStrand(bones, n, m.hairBack, m.white, 0, top + 0.1, -front - 0.18, -1, 0.98)

  // Plaid shirt, long sleeves.
  bones.spine1.add(part(b.torso, m.shirt, 0, TORSO_Y, 0))
  for (const arm of bones.arms) {
    arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
    arm.add(part(m.sleeve, m.shirt, 0, -CUFF_H / 2 + 0.03, ARM_Z))
  }

  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.pants, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.shoe, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- viking: horned helmet, grey beard, chainmail, leather bracers/boots ---
const LEATHER = '#4a3325'
const LEATHER_DARK = '#33231a'
const LEATHER_LIGHT = '#6a4a34'
const VIKING_BEARD = '#d9d6e0'
const VIKING_BEARD_STREAK = '#aeaab8'
const HELM_R = 1.18

// Rows of small overlapping rings, offset every other row.
function chainmail(ctx, w, h) {
  ctx.fillStyle = '#5c5e64'
  ctx.fillRect(0, 0, w, h)
  const pitch = 8
  ctx.lineWidth = 2
  for (let row = 0; row * pitch * 0.7 < h + pitch; row++) {
    const y = row * pitch * 0.7
    const off = row % 2 ? pitch / 2 : 0
    for (let x = -pitch; x < w + pitch; x += pitch) {
      ctx.strokeStyle = '#3a3c41'
      ctx.beginPath()
      ctx.arc(x + off + 1, y + 1, pitch * 0.42, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = '#b4b7be'
      ctx.beginPath()
      ctx.arc(x + off, y, pitch * 0.42, Math.PI, Math.PI * 2)
      ctx.stroke()
    }
  }
}

// Leather with darker wrap bands across it.
function wrappedLeather(ctx, w, h, bands) {
  ctx.fillStyle = LEATHER
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(0, 0, w * 0.5, h)
  ctx.fillStyle = LEATHER_DARK
  for (let i = 1; i <= bands; i++) ctx.fillRect(0, (i / (bands + 1)) * h - 3, w, 6)
}

// A tapered, curved horn: a tube along `curve` whose rings shrink toward the
// tip (TubeGeometry samples the path with getPointAt, so ring i's centre is
// curve.getPointAt(i / segments)).
function hornGeometry(side) {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, 0),
    new Vector3(side * 0.45, 0.12, 0),
    new Vector3(side * 0.78, 0.45, 0.05),
    new Vector3(side * 0.82, 0.95, 0.12),
  ])
  const segments = 16
  const radial = 10
  const geo = new TubeGeometry(curve, segments, 0.2, radial, false)
  const pos = geo.attributes.position
  const v = new Vector3()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const c = curve.getPointAt(t)
    const k = 1 - 0.88 * t
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c)
      pos.setXYZ(idx, v.x, v.y, v.z)
    }
  }
  geo.computeVertexNormals()
  return geo
}

function dressViking(bones) {
  const b = base()
  const m = cached('viking', () => ({
    // Helmet: a flattened dome over the crown, a riveted rim band, a crest,
    // and a spectacle guard (eye rings + nose bar) drawn over the face.
    dome: new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    // Round, so its radius must clear the square head's corners (0.8·√2).
    rim: new CylinderGeometry(HELM_R + 0.04, HELM_R + 0.04, 0.26, 24),
    crest: new RoundedBoxGeometry(0.18, 0.14, 1.3, 2, 0.06),
    helmet: mat({
      roughness: 0.5,
      metalness: 0.25,
      map: canvasTexture(64, 64, (ctx, w, h) => grain(ctx, w, h, '#6b5140', '#7d6150', 8)),
    }),
    rimMat: mat({ color: '#4f3b2e', roughness: 0.45, metalness: 0.3 }),
    guard: decalMat(
      canvasTexture(256, 256, (ctx, w) => {
        ctx.fillStyle = '#4f3b2e'
        ctx.fillRect(0, 60, w, 22) // brow band under the rim
        for (const x of [98, 158]) {
          ctx.beginPath()
          ctx.ellipse(x, 104, 34, 30, 0, 0, Math.PI * 2)
          ctx.ellipse(x, 104, 22, 21, 0, 0, Math.PI * 2, true) // eye hole
          ctx.fill('evenodd')
        }
        ctx.fillRect(118, 70, 20, 78) // nose bar
      }),
    ),
    hornMat: mat({ color: '#e6e0e4', roughness: 0.6 }),
    hornL: hornGeometry(1),
    hornR: hornGeometry(-1),
    // Beard: wide and bushy, down to the belt.
    beard: mat({ map: canvasTexture(64, 128, (ctx, w, h) => grain(ctx, w, h, VIKING_BEARD, VIKING_BEARD_STREAK, 14)) }),
    beardHang: skinStrand(hangingStrand(2.0, 2.9, 0.6, { tipX: 0.25, tipZ: 0.55, bend: 0.15 }), 6),
    beardSide: new RoundedBoxGeometry(0.18, 0.8, 1.05, 3, 0.08),
    stache: new RoundedBoxGeometry(0.62, 0.2, 0.18, 3, 0.08),
    // Chainmail shirt with a belt and a hanging strap.
    mail: mat({ roughness: 0.4, metalness: 0.5, map: canvasTexture(128, 128, chainmail) }),
    mailFront: decalMat(
      canvasTexture(256, 220, (ctx, w, h) => {
        ctx.fillStyle = LEATHER
        ctx.fillRect(0, h * 0.8, w, h * 0.12) // belt
        ctx.fillStyle = '#b09a70'
        ctx.fillRect(w / 2 - 12, h * 0.8, 24, h * 0.12) // buckle
        ctx.fillStyle = LEATHER_DARK
        ctx.fillRect(w / 2 - 8, h * 0.92, 16, h * 0.08) // strap
      }),
    ),
    // Chainmail upper sleeve over a wrapped leather bracer.
    mailSleeve: new RoundedBoxGeometry(ARM[0] + 0.1, 1.2, ARM[2] + 0.1, 4, 0.3),
    bracer: new RoundedBoxGeometry(ARM[0] + 0.16, 0.95, ARM[2] + 0.16, 4, 0.26),
    bracerMat: mat({ map: canvasTexture(64, 128, (ctx, w, h) => wrappedLeather(ctx, w, h, 2)) }),
    // Legs: mail skirt over the thigh, wrapped leather below; heavy boots.
    legs: mat({
      map: canvasTexture(64, 256, (ctx, w, h) => {
        wrappedLeather(ctx, w, h, 4)
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, 0, w, h * 0.42)
        ctx.clip()
        chainmail(ctx, w, h)
        ctx.restore()
        ctx.fillStyle = LEATHER_LIGHT
        ctx.fillRect(0, h * 0.42, w, 5) // skirt edge
      }),
    }),
    boot: mat({
      roughness: 0.55,
      map: canvasTexture(64, 64, (ctx, w, h) => {
        ctx.fillStyle = LEATHER_DARK
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = LEATHER_LIGHT
        ctx.fillRect(0, h * 0.2, w, 4) // cuff
        ctx.fillStyle = '#1f1510'
        ctx.fillRect(0, h * 0.8, w, h * 0.2) // sole
      }),
    }),
  }))

  dressHead(bones)
  const n = bones.neck1
  const top = HEAD[1]
  const front = HEAD[2] / 2

  // Guard sits just in front of the face decal (same plane, drawn after).
  n.add(decal(m.guard, HEAD[0], HEAD[1], 0, HEAD_Y, front + 0.006))

  const dome = part(m.dome, m.helmet, 0, top - 0.3, 0)
  dome.scale.set(HELM_R, 0.78, HELM_R)
  n.add(dome)
  n.add(part(m.rim, m.rimMat, 0, top - 0.3, 0))
  n.add(part(m.crest, m.rimMat, 0, top + 0.43, 0))
  n.add(part(m.hornL, m.hornMat, HELM_R - 0.1, top - 0.1, 0))
  n.add(part(m.hornR, m.hornMat, -HELM_R + 0.1, top - 0.1, 0))

  // Beard + moustache, framing the smile like the elder's.
  for (const s of [-1, 1]) {
    const stache = part(m.stache, m.beard, s * 0.28, 0.72, front + 0.07)
    stache.rotation.z = s * -0.28
    n.add(stache)
    n.add(part(m.beardSide, m.beard, s * (HEAD[0] / 2 + 0.05), 0.45, 0.2))
  }
  // Swings with hairPhysics.js, kept just clear of the chest like the elder's.
  hairStrand(bones, n, m.beardHang, m.beard, 0, 0.48, front + 0.2, 1, 1.0)

  bones.spine1.add(part(b.torso, m.mail, 0, TORSO_Y, 0))
  bones.spine1.add(decal(m.mailFront, TORSO[0], TORSO[1] - 0.05, 0, TORSO_Y, TORSO[2] / 2 + 0.004))

  for (const arm of bones.arms) {
    arm.add(part(b.arm, b.skin, 0, ARM_Y, ARM_Z))
    arm.add(part(m.mailSleeve, m.mail, 0, -0.57, ARM_Z))
    arm.add(part(m.bracer, m.bracerMat, 0, -1.5, ARM_Z))
  }

  for (const [leg, side] of bones.legs) {
    leg.add(part(b.leg, m.legs, side * 0.1, LEG_Y, 0))
    leg.add(part(b.shoe, m.boot, side * 0.1, SHOE_Y, 0.04))
  }
}

// --- skeleton: bare bones on the same joint pivots --------------------------
// Unlike the blocky outfits, every piece is a thin rod or a knob placed in
// its bone's local space, so the limbs still pivot at the rig's shoulders
// and hips and the walk cycle drives them unchanged.
const BONE_COLOR = '#ebe7dc'
const SOCKET = '#2b2724'
const _UP = new Vector3(0, 1, 0)

function skeletonShared() {
  return cached('skeleton', () => {
    // Ribs: a unit ring lying flat (XZ plane), scaled per rib.
    const rib = new TorusGeometry(1, 0.055, 6, 28)
    rib.rotateX(Math.PI / 2)
    return {
      rod: new CylinderGeometry(1, 1, 1, 8),
      knob: new SphereGeometry(1, 14, 10),
      rib,
      box: new RoundedBoxGeometry(1, 1, 1, 3, 0.2),
      bone: mat({ color: BONE_COLOR, roughness: 0.65 }),
      socket: mat({ color: SOCKET, roughness: 0.9 }),
      teeth: mat({
        color: BONE_COLOR,
        map: canvasTexture(128, 32, (ctx, w, h) => {
          ctx.fillStyle = BONE_COLOR
          ctx.fillRect(0, 0, w, h)
          ctx.fillStyle = SOCKET
          ctx.fillRect(0, h / 2 - 1, w, 2) // bite line
          for (let x = 0; x <= w; x += 12) ctx.fillRect(x, 0, 2, h)
        }),
      }),
    }
  })
}

function dressSkeleton(bones) {
  const s = skeletonShared()
  const v = (x, y, z) => new Vector3(x, y, z)

  // A cylinder of radius r spanning a -> b.
  const rod = (parent, a, b, r, material = s.bone) => {
    const dir = b.clone().sub(a)
    const m = part(s.rod, material, 0, 0, 0)
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.scale.set(r, dir.length(), r)
    m.quaternion.setFromUnitVectors(_UP, dir.normalize())
    parent.add(m)
    return m
  }
  // An ellipsoid knob (joint ends, skull, vertebrae).
  const knob = (parent, p, sx, sy = sx, sz = sx, material = s.bone) => {
    const m = part(s.knob, material, p.x, p.y, p.z)
    m.scale.set(sx, sy, sz)
    parent.add(m)
    return m
  }
  const box = (parent, p, sx, sy, sz, material = s.bone) => {
    const m = part(s.box, material, p.x, p.y, p.z)
    m.scale.set(sx, sy, sz)
    parent.add(m)
    return m
  }

  // --- Skull on the neck (head-local: 0 at the neck, 1.6 at the crown).
  const n = bones.neck1
  for (let y = 0.04; y < 0.34; y += 0.1) knob(n, v(0, y, -0.1), 0.13, 0.05, 0.13)
  knob(n, v(0, 1.02, -0.05), 0.64, 0.6, 0.72) // cranium
  box(n, v(0, 0.62, 0.22), 0.86, 0.46, 0.62) // cheeks + upper jaw
  box(n, v(0, 0.3, 0.2), 0.7, 0.2, 0.56) // lower jaw
  box(n, v(0, 0.44, 0.52), 0.5, 0.14, 0.04, s.teeth)
  for (const x of [-1, 1]) {
    knob(n, v(x * 0.25, 0.84, 0.5), 0.17, 0.15, 0.08, s.socket) // eye socket
    knob(n, v(x * 0.4, 0.66, 0.36), 0.12, 0.1, 0.16) // cheekbone
  }
  knob(n, v(0, 0.64, 0.53), 0.06, 0.1, 0.04, s.socket) // nasal cavity

  // --- Torso on Spine1 (local: 0 at the hips, 2.4 at the shoulders).
  const t = bones.spine1
  const spineZ = -0.5
  for (let y = 0.35; y < 2.35; y += 0.15) knob(t, v(0, y, spineZ + (y > 1.1 ? 0 : 0.2)), 0.14, 0.055, 0.13)
  // Ribcage: six rings, widest in the middle, sloping down toward the front.
  const ribs = [
    [2.15, 0.62, 0.42],
    [1.97, 0.82, 0.5],
    [1.79, 0.94, 0.55],
    [1.61, 0.98, 0.56],
    [1.43, 0.94, 0.54],
    [1.25, 0.84, 0.5],
  ]
  for (const [y, rx, rz] of ribs) {
    const r = part(s.rib, s.bone, 0, y, -0.05)
    r.scale.set(rx, 1, rz)
    r.rotation.x = 0.18
    t.add(r)
  }
  rod(t, v(0, 2.22, 0.36), v(0, 1.38, 0.56), 0.07) // sternum
  for (const x of [-1, 1]) {
    rod(t, v(x * 0.15, 2.36, 0.38), v(x * 1.85, 2.42, 0.36), 0.06) // collarbone
    knob(t, v(x * 0.62, 1.95, -0.52), 0.36, 0.44, 0.05) // shoulder blade
  }
  // Pelvis: two flared hip wings, the sacrum and the pubic ring.
  for (const x of [-1, 1]) {
    const wing = knob(t, v(x * 0.48, 0.3, -0.12), 0.4, 0.3, 0.07)
    wing.rotation.set(0.15, x * 0.7, x * -0.4)
  }
  knob(t, v(0, 0.12, -0.35), 0.24, 0.32, 0.14)
  const pubis = part(s.rib, s.bone, 0, -0.02, 0.12)
  pubis.scale.set(0.42, 1.4, 0.26)
  pubis.rotation.x = 0.5
  t.add(pubis)

  // --- Arms (shoulder pivot; ARM_Z brings them back onto the body's z = 0).
  for (const arm of bones.arms) {
    const z = ARM_Z
    knob(arm, v(0, -0.08, z), 0.2)
    rod(arm, v(0, -0.1, z), v(0, -1.12, z), 0.1) // humerus
    knob(arm, v(0, -1.2, z), 0.14)
    rod(arm, v(-0.07, -1.26, z), v(-0.07, -2.02, z), 0.06) // radius
    rod(arm, v(0.07, -1.26, z), v(0.07, -2.02, z), 0.055) // ulna
    knob(arm, v(0, -2.08, z), 0.11)
    box(arm, v(0, -2.22, z), 0.34, 0.24, 0.12) // palm
    for (let i = 0; i < 4; i++) {
      const x = -0.12 + i * 0.08
      rod(arm, v(x, -2.32, z), v(x, -2.56, z + 0.05), 0.028) // fingers
    }
    rod(arm, v(0.18, -2.2, z), v(0.24, -2.42, z + 0.1), 0.03) // thumb
  }

  // --- Legs (hip pivot; feet reach the ground at local y -2.4).
  for (const [leg] of bones.legs) {
    knob(leg, v(0, -0.06, 0), 0.18) // femoral head
    rod(leg, v(0, -0.1, 0), v(0, -1.1, 0), 0.12) // femur
    knob(leg, v(0, -1.18, 0.02), 0.17) // knee
    rod(leg, v(-0.04, -1.26, 0), v(-0.04, -2.18, 0), 0.09) // tibia
    rod(leg, v(0.12, -1.28, -0.02), v(0.12, -2.16, -0.02), 0.05) // fibula
    knob(leg, v(0, -2.24, 0), 0.12) // ankle
    box(leg, v(0, -2.33, 0.2), 0.4, 0.14, 0.62) // foot
    for (let i = 0; i < 5; i++) {
      const x = -0.16 + i * 0.08
      rod(leg, v(x, -2.36, 0.5), v(x, -2.37, 0.78), 0.035) // toes
    }
  }
}

// --- ghost: translucent body, grinning head, black claws, a tail for legs --
// The body is see-through with a darker opaque "T" core inside it (across
// the shoulders and down the chest); the head is solid. There are no leg
// meshes — the leg bones still swing, but only the tapering tail shows.
const GHOST = '#d5dc79'
const GHOST_CORE = '#5d5c2d'
const GHOST_INK = '#34342f'

function dressGhost(bones) {
  const b = base()
  const m = cached('ghost', () => ({
    body: mat({ color: GHOST, transparent: true, opacity: 0.55, depthWrite: false }),
    core: mat({ color: GHOST_CORE, roughness: 0.9 }),
    head: mat({ color: GHOST, roughness: 0.5 }),
    black: mat({ color: '#141414', roughness: 0.5 }),
    face: decalMat(
      canvasTexture(256, 256, (ctx) => {
        ctx.fillStyle = GHOST_INK
        // Eyes: squashed ovals with flat bottoms.
        for (const x of [98, 160]) {
          ctx.beginPath()
          ctx.ellipse(x, 100, 25, 22, 0, Math.PI, Math.PI * 2)
          ctx.lineTo(x + 25, 110)
          ctx.lineTo(x - 25, 110)
          ctx.closePath()
          ctx.fill()
        }
        // Big open grin: flat top, round bottom.
        ctx.beginPath()
        ctx.moveTo(72, 136)
        ctx.lineTo(186, 136)
        ctx.bezierCurveTo(186, 200, 72, 200, 72, 136)
        ctx.fill()
      }),
    ),
    cuff: new RoundedBoxGeometry(ARM[0] + 0.16, 0.45, ARM[2] + 0.16, 2, 0.05),
    claw: new ConeGeometry(0.08, 1.4, 6),
    tail: new RoundedBoxGeometry(1, 1, 1, 2, 0.06),
  }))

  // Head: solid, with the grin on its front.
  const n = bones.neck1
  n.add(part(b.head, m.head, 0, HEAD_Y, 0))
  n.add(decal(m.face, HEAD[0], HEAD[1], 0, HEAD_Y, HEAD[2] / 2 + 0.003))

  // Torso shell + the T core (shoulder band and chest stem).
  const t = bones.spine1
  t.add(part(b.torso, m.body, 0, TORSO_Y, 0))
  for (const [y, w, h] of [[1.75, 2.5, 0.7], [1.0, 1.1, 1.2]]) {
    const core = part(m.tail, m.core, 0, y, 0)
    core.scale.set(w, h, 1.1)
    t.add(core)
  }

  // Tail: stacked, shrinking translucent blocks where the legs would be.
  const tail = [
    [-0.35, 2.6, 0.8, 1.5],
    [-0.95, 2.0, 0.6, 1.3],
    [-1.4, 1.45, 0.45, 1.05],
    [-1.75, 0.95, 0.35, 0.8],
  ]
  for (const [y, w, h, d] of tail) {
    const piece = part(m.tail, m.body, 0, y, 0.05)
    piece.scale.set(w, h, d)
    t.add(piece)
  }

  // Arms: translucent with the core showing in the upper arm, black cuffs,
  // and three long claws hanging from each.
  for (const arm of bones.arms) {
    arm.add(part(b.arm, m.body, 0, ARM_Y, ARM_Z))
    const core = part(m.tail, m.core, 0, -0.95, ARM_Z)
    core.scale.set(0.8, 1.4, 1.1)
    arm.add(core)
    arm.add(part(m.cuff, m.black, 0, -2.2, ARM_Z))
    for (const x of [-0.38, 0, 0.38]) {
      const claw = part(m.claw, m.black, x, -2.42 - 0.7, ARM_Z + 0.1)
      claw.rotation.set(0, 0, Math.PI + x * 0.25) // point down, fanned out
      arm.add(claw)
    }
  }
}

const OUTFITS = {
  plain: dressPlain,
  striped: dressStriped,
  suit: dressSuit,
  shades: dressShades,
  beard: dressBeard,
  grandpa: dressGrandpa,
  elder: dressElder,
  viking: dressViking,
  skeleton: dressSkeleton,
  ghost: dressGhost,
}

// The outfit the player wears at each Age level: level 0 is the first entry,
// level 9 the last, and every level above 9 stays on the last (ghost) for good.
const LEVEL_OUTFITS = ['plain', 'striped', 'suit', 'shades', 'beard', 'grandpa', 'elder', 'viking', 'skeleton', 'ghost']

export function outfitForLevel(level) {
  const n = Number.isFinite(level) ? Math.floor(level) : 0
  return LEVEL_OUTFITS[Math.max(0, Math.min(n, LEVEL_OUTFITS.length - 1))]
}

// Returns a Group shaped like assembleAvatar()'s result: `nodes` (name ->
// node) and `animations` (none — avatarAnim.js falls back to its generated
// gait) stashed on the root, already scaled from rig units to game metres.
// An unknown outfit id falls back to DEFAULT_OUTFIT.
export function buildDefaultCharacter(outfit = DEFAULT_OUTFIT) {
  const root = new Group()
  root.name = 'character'
  const bones = buildRig(root)
  ;(OUTFITS[outfit] || OUTFITS[DEFAULT_OUTFIT])(bones)

  root.animations = []
  root.nodes = {}
  root.traverse((o) => {
    if (o.name) root.nodes[o.name] = o
  })
  root.scale.setScalar(player.dims.height / RIG_HEIGHT)

  // Physics strands bind to their bone chains in the finished rest pose.
  if (bones.strands.length) {
    root.updateMatrixWorld(true)
    root.hair = bones.strands.map((s) => {
      s.mesh.bind(new Skeleton(s.chain))
      return makeStrand(s.chain, s.rest, s.side, s.body)
    })
  }
  return root
}
