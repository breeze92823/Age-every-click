import * as THREE from 'three'
import { WHEEL_PRIZES, SLICE_LINES } from '../data/luckyWheel.js'

// Canvas-painted textures for the island's signage and conveyor curbs, so
// the level stays free of image/font asset downloads (same idea as
// studTexture.js).

const LABEL_FONT = '"Arial Black", "Segoe UI Black", system-ui, sans-serif'

function roundedRectPath(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// Bold outlined billboard text, Roblox-sign style. Returns the texture plus
// its width/height ratio so a sprite can be scaled without distortion.
// `gradient` (optional array of CSS colors) fills the text with a left-to-right
// linear gradient across its width instead of the flat `color`.
export function makeLabelTexture(text, { color = '#ffffff', stroke = '#1b1b1f', px = 96, gradient = null } = {}) {
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const font = `900 ${px}px ${LABEL_FONT}`
  g.font = font
  const pad = px * 0.3
  const w = Math.ceil(g.measureText(text).width + pad * 2)
  const h = Math.ceil(px * 1.4)
  canvas.width = w
  canvas.height = h

  // Resizing the canvas resets its 2D state.
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = px * 0.2
  g.strokeStyle = stroke
  g.strokeText(text, w / 2, h / 2)
  if (gradient) {
    const fill = g.createLinearGradient(pad, 0, w - pad, 0)
    gradient.forEach((c, i) => fill.addColorStop(i / Math.max(1, gradient.length - 1), c))
    g.fillStyle = fill
  } else {
    g.fillStyle = color
  }
  g.fillText(text, w / 2, h / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

// Two-line billboard label for the age machines: a bold tier name over a
// smaller white rate line, baked into one canvas so it's a single sprite.
export function makeTierLabelTexture(name, rate, { nameColor = '#ffffff', stroke = '#1b1b1f', px = 96 } = {}) {
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const nameFont = `900 ${px}px ${LABEL_FONT}`
  const rateFont = `900 ${px * 0.6}px ${LABEL_FONT}`
  g.font = nameFont
  const nameWidth = g.measureText(name).width
  g.font = rateFont
  const rateWidth = g.measureText(rate).width
  const pad = px * 0.3
  const w = Math.ceil(Math.max(nameWidth, rateWidth) + pad * 2)
  const nameH = px * 1.15
  const rateH = px * 0.85
  const h = Math.ceil(nameH + rateH)
  canvas.width = w
  canvas.height = h

  // Resizing the canvas resets its 2D state.
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'

  g.font = nameFont
  g.lineWidth = px * 0.2
  g.strokeStyle = stroke
  g.strokeText(name, w / 2, nameH / 2)
  g.fillStyle = nameColor
  g.fillText(name, w / 2, nameH / 2)

  g.font = rateFont
  g.lineWidth = px * 0.14
  g.strokeStyle = stroke
  g.strokeText(rate, w / 2, nameH + rateH / 2)
  g.fillStyle = '#ffffff'
  g.fillText(rate, w / 2, nameH + rateH / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

// Translucent black capsule badge with a procedural coin icon + price text —
// the Age Machine buy banner's price tag. No image asset, same reasoning as
// the rest of this file.
export function makePriceTagTexture(text, { px = 96 } = {}) {
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const font = `900 ${px}px ${LABEL_FONT}`
  g.font = font
  const coinD = px * 1.15
  const padX = px * 0.32
  const gap = px * 0.22
  const textW = g.measureText(text).width
  const h = Math.ceil(px * 1.55)
  const w = Math.ceil(padX * 2 + coinD + gap + textW)
  canvas.width = w
  canvas.height = h

  // Resizing the canvas resets its 2D state.
  const lw = px * 0.16
  g.lineJoin = 'round'
  roundedRectPath(g, lw / 2, lw / 2, w - lw, h - lw, h / 2 - lw / 2)
  g.fillStyle = 'rgba(0, 0, 0, 0.55)'
  g.fill()
  g.lineWidth = lw
  g.strokeStyle = '#1b1b1f'
  g.stroke()

  const cx = padX + coinD / 2
  const cy = h / 2
  g.beginPath()
  g.arc(cx, cy, coinD / 2 - lw * 0.4, 0, Math.PI * 2)
  g.fillStyle = '#ffb020'
  g.fill()
  g.lineWidth = px * 0.09
  g.strokeStyle = '#c97800'
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, coinD / 2 - px * 0.28, 0, Math.PI * 2)
  g.lineWidth = px * 0.06
  g.strokeStyle = '#ffd782'
  g.stroke()

  g.font = font
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillStyle = '#ffffff'
  g.fillText(text, padX + coinD + gap, cy + px * 0.03)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

// Rounded, outlined green button — the Age Machine buy banner's clickable
// half. `label` switches from "Buy" to "Use" once the machine is owned.
export function makeBuyButtonTexture({ label = 'Buy', px = 96 } = {}) {
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const font = `900 ${px}px ${LABEL_FONT}`
  g.font = font
  const padX = px * 0.7
  const textW = g.measureText(label).width
  const h = Math.ceil(px * 1.4)
  const w = Math.ceil(textW + padX * 2)
  canvas.width = w
  canvas.height = h

  const lw = px * 0.16
  g.lineJoin = 'round'
  roundedRectPath(g, lw / 2, lw / 2, w - lw, h - lw, h / 2 - lw / 2)
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#7cf07a')
  grad.addColorStop(1, '#2fb84b')
  g.fillStyle = grad
  g.fill()
  g.lineWidth = lw
  g.strokeStyle = '#1b1b1f'
  g.stroke()

  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = px * 0.13
  g.strokeStyle = '#1b1b1f'
  g.strokeText(label, w / 2, h / 2 + px * 0.02)
  g.fillStyle = '#ffffff'
  g.fillText(label, w / 2, h / 2 + px * 0.02)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

// Translucent black pill with centered text, no coin icon — the price tag's
// slot once a machine is owned, reading e.g. "Owned".
export function makeStatusTagTexture(text, { px = 96 } = {}) {
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const font = `900 ${px}px ${LABEL_FONT}`
  g.font = font
  const padX = px * 0.55
  const textW = g.measureText(text).width
  const h = Math.ceil(px * 1.55)
  const w = Math.ceil(textW + padX * 2)
  canvas.width = w
  canvas.height = h

  const lw = px * 0.16
  g.lineJoin = 'round'
  roundedRectPath(g, lw / 2, lw / 2, w - lw, h - lw, h / 2 - lw / 2)
  g.fillStyle = 'rgba(0, 0, 0, 0.55)'
  g.fill()
  g.lineWidth = lw
  g.strokeStyle = '#1b1b1f'
  g.stroke()

  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#8fffa0'
  g.fillText(text, w / 2, h / 2 + px * 0.03)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

// Self row's highlight stripe + name tint — a "that's you" cue picking the
// local player's row out from every other (remote/saved) row on the board,
// same idea as Ice-Skate's own LeaderboardSign self-highlight.
const SELF_ROW_BG = 'rgba(57, 255, 136, 0.22)'
const SELF_NAME_COLOR = '#8dffb0'

// Ranked rows of name + value baked onto a wood-plaque backing — the
// leaderboard signboards' plaque texture. `entries` is ordered best-first,
// each `{ name, value, isSelf }` — `isSelf` (systems/net.js's getLeaderboard()
// flag) highlights the local player's own row so it reads apart from every
// remote player's row at a glance. `slots` reserves row height for a fixed
// number of rows (defaulting to entries.length for backward compatibility)
// rather than sizing rows to however many entries happen to be passed —
// components/IslandLandmarks.jsx always passes its live board's full
// LEADERBOARD_VISIBLE_ROWS here, so a solo/offline board showing just the
// local player's own row still draws one properly-proportioned row (leaving
// the rest of the plaque blank) instead of stretching that lone row to fill
// the whole board.
export function makeLeaderboardTexture(entries, { accent = '#ffd23d', w = 600, h = 400, slots } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')

  g.fillStyle = '#6a4424'
  g.fillRect(0, 0, w, h)

  const padX = w * 0.06
  const padY = h * 0.05
  const rowH = (h - padY * 2) / (slots || entries.length || 1)
  const rankColors = ['#ffd54a', '#d8dce3', '#e08a3c']

  g.textBaseline = 'middle'
  entries.forEach((entry, i) => {
    const rowY = padY + rowH * i
    const y = rowY + rowH / 2
    if (entry.isSelf) {
      g.fillStyle = SELF_ROW_BG
      g.fillRect(padX * 0.4, rowY, w - padX * 0.8, rowH)
    } else if (i % 2 === 1) {
      g.fillStyle = 'rgba(255, 255, 255, 0.06)'
      g.fillRect(padX * 0.4, rowY, w - padX * 0.8, rowH)
    }

    const fontSize = rowH * 0.55
    g.textAlign = 'left'
    g.font = `900 ${fontSize}px ${LABEL_FONT}`
    g.fillStyle = rankColors[i] || '#c9a876'
    g.fillText(`${i + 1}.`, padX, y)

    g.font = `700 ${fontSize * 0.9}px ${LABEL_FONT}`
    g.fillStyle = entry.isSelf ? SELF_NAME_COLOR : '#f4ead2'
    g.fillText(entry.name, padX + fontSize * 1.6, y)

    g.textAlign = 'right'
    g.font = `900 ${fontSize * 0.9}px ${LABEL_FONT}`
    g.fillStyle = accent
    g.fillText(entry.value, w - padX, y)
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// `count` chevrons per tile, pointing along +U. Transparent when no
// background is given, for floor arrows laid over another surface.
export function makeChevronTexture({ color, background = null, count = 1 }) {
  const tile = 64
  const canvas = document.createElement('canvas')
  canvas.width = tile * count
  canvas.height = tile
  const g = canvas.getContext('2d')
  if (background) {
    g.fillStyle = background
    g.fillRect(0, 0, canvas.width, tile)
  }
  g.fillStyle = color
  for (let i = 0; i < count; i++) {
    const x = i * tile
    g.beginPath()
    g.moveTo(x + tile * 0.18, tile * 0.12)
    g.lineTo(x + tile * 0.52, tile * 0.12)
    g.lineTo(x + tile * 0.86, tile * 0.5)
    g.lineTo(x + tile * 0.52, tile * 0.88)
    g.lineTo(x + tile * 0.18, tile * 0.88)
    g.lineTo(x + tile * 0.52, tile * 0.5)
    g.closePath()
    g.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Age Machine glass: one raised, bevelled square pane per tile over a
// fainter backing, all white so the glass material's color tints it. The
// alpha channel carries the pattern, so panes read more solid than the gaps.
export function makeGlassGridTexture({ repeatX = 12, repeatY = 8 } = {}) {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(0, 0, size, size)

  const inset = size * 0.14
  const pane = size - inset * 2
  const bevel = size * 0.07
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.fillRect(inset, inset, pane, pane)
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.fillRect(inset, inset, pane, bevel)
  g.fillRect(inset, inset, bevel, pane)
  g.fillStyle = 'rgba(150,175,200,0.8)'
  g.fillRect(inset, inset + pane - bevel, pane, bevel)
  g.fillRect(inset + pane - bevel, inset, bevel, pane)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// Molten Age Machine skin: near-black rock split by branching orange cracks
// with hot yellow cores. Used as both map and emissiveMap, so the cracks
// glow while the rock stays dark. Seamless like makeWaterTexture.
export function makeLavaTexture({ repeatX = 3, repeatY = 1 } = {}) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = '#1c120c'
  g.fillRect(0, 0, size, size)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  let seed = 11
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  // Each crack is a jagged polyline, sometimes forking once.
  const cracks = []
  for (let i = 0; i < 9; i++) {
    let x = rand() * size
    let y = rand() * size
    let a = rand() * Math.PI * 2
    const pts = [[x, y]]
    const steps = 4 + Math.floor(rand() * 4)
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 1.3
      const len = 14 + rand() * 22
      x += Math.cos(a) * len
      y += Math.sin(a) * len
      pts.push([x, y])
      if (s === 2 && rand() < 0.6) {
        const b = a + (rand() < 0.5 ? 1 : -1) * (0.7 + rand() * 0.6)
        cracks.push([
          [x, y],
          [x + Math.cos(b) * 24, y + Math.sin(b) * 24],
          [x + Math.cos(b) * 44 + (rand() - 0.5) * 16, y + Math.sin(b) * 44 + (rand() - 0.5) * 16],
        ])
      }
    }
    cracks.push(pts)
  }
  const strokeAll = (width, color) => {
    g.lineWidth = width
    g.strokeStyle = color
    for (const pts of cracks) {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          g.beginPath()
          pts.forEach(([px, py], n) => (n ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)))
          g.stroke()
        }
      }
    }
  }
  strokeAll(12, 'rgba(255,70,10,0.35)')
  strokeAll(7, '#ff6a12')
  strokeAll(3, '#ffc93a')

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Seamless sea-surface tile: a pale-blue base with short white ripple arcs.
// Multiplied by the water material's colour, so the base only needs to be a
// touch off-white for the ripples to read as highlights.
export function makeWaterTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = '#d8ecff'
  g.fillRect(0, 0, size, size)
  g.lineCap = 'round'
  // Deterministic scatter so every load draws the same sea.
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 26; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 10 + rand() * 16
    const a0 = rand() * Math.PI * 2
    g.strokeStyle = `rgba(255,255,255,${0.5 + rand() * 0.4})`
    g.lineWidth = 2.5 + rand() * 2
    // Drawn once per wrapped copy so arcs crossing an edge tile seamlessly.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        g.beginPath()
        g.arc(x + ox, y + oy, r, a0, a0 + Math.PI * 0.6)
        g.stroke()
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Outlined billboard text with a procedural icon on its left — "coin" (the
// same gold coin as makePriceTagTexture) or "rebirth" (two pink chasing
// arrows, the HUD's Rebirth button motif). Area 2's AFK sign and gate.
export function makeIconLabelTexture(text, { icon = 'coin', color = '#ffffff', stroke = '#1b1b1f', px = 96 } = {}) {
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const font = `900 ${px}px ${LABEL_FONT}`
  g.font = font
  const pad = px * 0.3
  const iconD = px * 1.1
  const gap = px * 0.15
  const textW = g.measureText(text).width
  const w = Math.ceil(pad * 2 + iconD + gap + textW)
  const h = Math.ceil(px * 1.4)
  canvas.width = w
  canvas.height = h

  // Resizing the canvas resets its 2D state.
  const cx = pad + iconD / 2
  const cy = h / 2
  const r = iconD / 2
  g.lineJoin = 'round'
  if (icon === 'rebirth') {
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fillStyle = '#ffffff'
    g.fill()
    g.lineWidth = px * 0.08
    g.strokeStyle = stroke
    g.stroke()
    const ar = r * 0.58
    g.lineWidth = px * 0.16
    g.strokeStyle = '#ff4fa3'
    g.fillStyle = '#ff4fa3'
    for (const start of [-0.35, Math.PI - 0.35]) {
      const end = start + Math.PI * 0.72
      g.beginPath()
      g.arc(cx, cy, ar, start, end)
      g.stroke()
      // Arrowhead at the arc's end, pointing along its direction of travel.
      const hx = cx + Math.cos(end) * ar
      const hy = cy + Math.sin(end) * ar
      const tx = -Math.sin(end)
      const ty = Math.cos(end)
      const s = px * 0.2
      g.beginPath()
      g.moveTo(hx + tx * s, hy + ty * s)
      g.lineTo(hx - Math.cos(end) * s, hy - Math.sin(end) * s)
      g.lineTo(hx + Math.cos(end) * s, hy + Math.sin(end) * s)
      g.closePath()
      g.fill()
    }
  } else {
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fillStyle = '#ffb020'
    g.fill()
    g.lineWidth = px * 0.12
    g.strokeStyle = stroke
    g.stroke()
    g.beginPath()
    g.arc(cx, cy, r - px * 0.1, 0, Math.PI * 2)
    g.lineWidth = px * 0.07
    g.strokeStyle = '#c97800'
    g.stroke()
    g.beginPath()
    g.ellipse(cx, cy, r * 0.28, r * 0.55, 0, 0, Math.PI * 2)
    g.fillStyle = '#ffd782'
    g.fill()
  }

  g.font = font
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.lineWidth = px * 0.2
  g.strokeStyle = stroke
  const tx = pad + iconD + gap
  g.strokeText(text, tx, cy)
  g.fillStyle = color
  g.fillText(text, tx, cy)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
}

// The Lucky Wheel popup's face (components/hud/LuckyWheel.jsx's WheelFace +
// hub cap), repainted on a canvas for the Statue's medallion. Drawn in the
// SVG's own -100..100 viewBox space, so its numbers can be kept in sync by
// eye. Slice 0 sits at 12 o'clock, clockwise, same as the popup. The area
// outside the ring is stone-colored so it blends into the disc's rim.
export function makeWheelFaceTexture({ size = 1024, background = '#d0d5de' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = background
  g.fillRect(0, 0, size, size)
  g.translate(size / 2, size / 2)
  g.scale(size / 200, size / 200)
  g.lineJoin = 'round'
  g.lineCap = 'round'

  const R_RING = 98
  const R_SLICE = 90
  const sliceRad = (Math.PI * 2) / WHEEL_PRIZES.length

  g.beginPath()
  g.arc(0, 0, R_RING, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  g.lineWidth = 2.5
  g.strokeStyle = '#000'
  g.stroke()

  // Canvas angles run from +X; the popup's run clockwise from 12 o'clock.
  WHEEL_PRIZES.forEach((prize, i) => {
    const mid = i * sliceRad - Math.PI / 2
    g.beginPath()
    g.moveTo(0, 0)
    g.arc(0, 0, R_SLICE, mid - sliceRad / 2, mid + sliceRad / 2)
    g.closePath()
    g.fillStyle = prize.color
    g.fill()
    g.lineWidth = 2.5
    g.stroke()
  })

  WHEEL_PRIZES.forEach((prize, i) => {
    g.save()
    g.rotate(i * sliceRad)
    g.save()
    g.translate(0, -60)
    drawWheelPrizeIcon(g, prize.kind)
    g.restore()
    g.font = `900 8.5px ${LABEL_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 2.4
    g.strokeStyle = '#000'
    g.fillStyle = '#fff'
    const lines = SLICE_LINES[prize.id]
    lines.forEach((line, n) => {
      const y = -38 + (n - (lines.length - 1) / 2) * 8.5 + (lines.length === 1 ? 4 : 0)
      g.strokeText(line, 0, y)
      g.fillText(line, 0, y)
    })
    g.restore()
  })

  // Hub cap.
  g.beginPath()
  g.arc(0, 0, 12, 0, Math.PI * 2)
  g.fillStyle = '#ff9d1a'
  g.fill()
  g.lineWidth = 2.5
  g.strokeStyle = '#000'
  g.stroke()
  g.beginPath()
  g.arc(0, 0, 8, 0, Math.PI * 2)
  g.fillStyle = '#ffc45c'
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = '#b45f06'
  g.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

// Canvas twin of LuckyWheel.jsx's PrizeIcon, drawn centred on the origin.
function drawWheelPrizeIcon(g, kind) {
  if (kind === 'age') {
    const arrow = new Path2D('M-9,3 L0,-10 L9,3 L3.5,3 L3.5,11 L-3.5,11 L-3.5,3 Z')
    g.lineWidth = 1.6
    g.strokeStyle = '#0b2540'
    g.fillStyle = '#eaf6ff'
    for (const [dx, dy] of [
      [-4, -3],
      [4, 3],
    ]) {
      g.save()
      g.translate(dx, dy)
      g.fill(arrow)
      g.stroke(arrow)
      g.restore()
    }
    return
  }
  if (kind === 'speedCoil') {
    const coil = new Path2D('M-10,-10 Q0,-15 10,-8 M-10,-3 Q0,-8 10,-1 M-10,4 Q0,-1 10,6 M-10,11 Q0,6 10,13')
    g.lineWidth = 6
    g.strokeStyle = '#3b0a12'
    g.stroke(coil)
    g.lineWidth = 3.4
    g.strokeStyle = '#ff7d92'
    g.stroke(coil)
    return
  }
  const emoji = kind === 'coins' ? '🪙' : kind === 'noLuck' ? '😢' : '🚀'
  g.font = '22px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#000'
  g.fillText(emoji, 0, 0)
}
