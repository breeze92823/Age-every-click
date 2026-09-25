import * as THREE from 'three'

// Canvas-painted textures for the island's signage and conveyor curbs, so
// the level stays free of image/font asset downloads (same idea as
// studTexture.js).

const LABEL_FONT = '"Arial Black", "Segoe UI Black", system-ui, sans-serif'

// Bold outlined billboard text, Roblox-sign style. Returns the texture plus
// its width/height ratio so a sprite can be scaled without distortion.
export function makeLabelTexture(text, { color = '#ffffff', stroke = '#1b1b1f', px = 96 } = {}) {
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
  g.fillStyle = color
  g.fillText(text, w / 2, h / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: w / h }
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
