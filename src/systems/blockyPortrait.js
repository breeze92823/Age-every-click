// Blocky Minecraft / Bloxity style figures used for the "Pick your gender"
// portraits (components/hud/GenderPicker.jsx). Unlike the in-game character
// these are plain boxes with tiny nearest-filtered textures, so every face of
// the head and every patch of clothing reads as chunky pixels. Units are
// arbitrary: y = 0 is the bottom of the sweater, the head sits straight on the
// shoulders, and the figure is about 6 units from toes to crown.
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
} from 'three'

const PX = 8 // head faces are 8x8 pixels, like a Minecraft skin
const HEAD = 2.2
const TORSO = [2.6, 2.2, 1.4]
const ARM = [0.9, 2.2, 1.2]
const CUFF_H = 0.4
const LEG = [1.3, 1.6, 1.3]
const BELT_H = 0.3

const THEMES = {
  boy: {
    skin: '#c58a60',
    hair: '#8b5a2b',
    sweater: '#9cc04a',
    cuff: '#ece7da',
    belt: '#7d7567',
    pants: '#b9a47d',
    longHair: false,
  },
  girl: {
    skin: '#d9a07a',
    hair: '#6e4020',
    sweater: '#e87aa6',
    cuff: '#f6eef2',
    belt: '#6b5a66',
    pants: '#4a6fa5',
    longHair: true,
  },
}

// Brightens or darkens a #rrggbb colour by `amt` (-1..1).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}

function pixelTexture(size, draw) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  draw(c.getContext('2d'))
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.generateMipmaps = false
  return tex
}

// Fills the whole texture with `color`, every pixel nudged a little lighter or
// darker, so flat colours still look like blocks of pixels.
function grain(ctx, size, color, spread = 0.1) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = shade(color, (Math.random() - 0.5) * 2 * spread)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function dot(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

// The six head faces, in BoxGeometry's material order: +x, -x, +y, -y, +z, -z.
function headTextures(t, girl) {
  const skin = (extra) =>
    pixelTexture(PX, (ctx) => {
      grain(ctx, PX, t.skin, 0.05)
      extra?.(ctx)
    })
  const hairFill = (ctx, x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) dot(ctx, x, y, shade(t.hair, (Math.random() - 0.5) * 0.3))
  }
  const sideRows = t.longHair ? 7 : 2
  const front = skin((ctx) => {
    hairFill(ctx, 0, 0, PX, 2)
    hairFill(ctx, 0, 2, 1, t.longHair ? 7 : 3) // sideburns / long side locks
    hairFill(ctx, 7, 2, 8, t.longHair ? 7 : 3)
    dot(ctx, 1, 3, shade(t.hair, -0.1)) // brows
    dot(ctx, 2, 3, shade(t.hair, -0.1))
    dot(ctx, 5, 3, shade(t.hair, -0.1))
    dot(ctx, 6, 3, shade(t.hair, -0.1))
    // Eyes: white then teal, mirrored.
    dot(ctx, 1, 4, '#f4f4f4')
    dot(ctx, 2, 4, '#2f8c93')
    dot(ctx, 5, 4, '#2f8c93')
    dot(ctx, 6, 4, '#f4f4f4')
    if (girl) {
      dot(ctx, 1, 3, '#2a1a14') // lashes
      dot(ctx, 6, 3, '#2a1a14')
      dot(ctx, 1, 5, 'rgba(240,120,150,0.8)') // blush
      dot(ctx, 6, 5, 'rgba(240,120,150,0.8)')
      hairFill(ctx, 0, 2, 1, 7)
      hairFill(ctx, 7, 2, 8, 7)
    }
    // Nose and mouth.
    dot(ctx, 3, 5, shade(t.skin, -0.25))
    dot(ctx, 4, 5, shade(t.skin, -0.25))
    dot(ctx, 3, 6, girl ? '#b3263a' : '#3b2218')
    dot(ctx, 4, 6, girl ? '#b3263a' : '#3b2218')
  })
  // Side faces: hair over the top rows and the back half (back = high u on +x,
  // low u on -x).
  const side = (backOnRight) =>
    skin((ctx) => {
      hairFill(ctx, 0, 0, PX, 2)
      hairFill(ctx, backOnRight ? 4 : 0, 2, backOnRight ? 8 : 4, sideRows)
    })
  const top = skin((ctx) => hairFill(ctx, 0, 0, PX, PX))
  const back = skin((ctx) => hairFill(ctx, 0, 0, PX, t.longHair ? PX : 6))
  return [side(true), side(false), top, skin(), front, back]
}

function flatTexture(color, spread = 0.1) {
  return pixelTexture(PX, (ctx) => grain(ctx, PX, color, spread))
}

export function buildBlockyFigure(gender) {
  const t = THEMES[gender] || THEMES.boy
  const girl = gender === 'girl'
  const textures = []
  const geometries = []
  const materials = []
  const mat = (tex) => {
    textures.push(tex)
    const m = new MeshLambertMaterial({ map: tex })
    materials.push(m)
    return m
  }
  const box = (w, h, d, material, x, y, z) => {
    const geo = new BoxGeometry(w, h, d)
    geometries.push(geo)
    const m = new Mesh(geo, material)
    m.position.set(x, y, z)
    return m
  }

  const sweater = mat(flatTexture(t.sweater))
  const cuff = mat(flatTexture(t.cuff, 0.04))
  const belt = mat(flatTexture(t.belt))
  const pants = mat(flatTexture(t.pants))
  const headMats = headTextures(t, girl).map(mat)

  const group = new Group()

  // Torso, with the belt as a slightly wider band at its foot.
  group.add(box(...TORSO, sweater, 0, TORSO[1] / 2, 0))
  group.add(box(TORSO[0] + 0.06, BELT_H, TORSO[2] + 0.06, belt, 0, BELT_H / 2, 0))

  // The head sits right on the shoulders (a hair's overlap, so no gap).
  group.add(box(HEAD, HEAD, HEAD, headMats, 0, TORSO[1] - 0.05 + HEAD / 2, 0))

  // Arms hang from the shoulder and splay out a little; white cuffs at the end.
  for (const s of [-1, 1]) {
    const arm = new Group()
    arm.position.set(s * (TORSO[0] / 2 + ARM[0] / 2), TORSO[1], 0)
    arm.rotation.z = s * 0.18
    const sleeveH = ARM[1] - CUFF_H
    arm.add(box(ARM[0], sleeveH, ARM[2], sweater, 0, -sleeveH / 2, 0))
    arm.add(box(ARM[0] + 0.04, CUFF_H, ARM[2] + 0.04, cuff, 0, -sleeveH - CUFF_H / 2, 0))
    group.add(arm)
  }

  // Legs, side by side so they read as one block of trousers.
  for (const s of [-1, 1]) group.add(box(...LEG, pants, s * (LEG[0] / 2), -LEG[1] / 2, 0))

  const dispose = () => {
    for (const x of [...textures, ...geometries, ...materials]) x.dispose()
  }
  return { group, dispose }
}
