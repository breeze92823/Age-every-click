import * as THREE from 'three'

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
