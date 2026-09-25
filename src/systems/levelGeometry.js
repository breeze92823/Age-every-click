import { BoxGeometry, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Builders for the island's flat, axis-aligned terrain pieces. Rects are
// [x0, z0, x1, z1]. Flat surfaces get world-space UVs (one texture tile per
// TILE metres), so a stud texture lines up seamlessly across every rect
// that shares it and all of them can merge into a single draw call.

export const TILE = 4

export function flatRect([x0, z0, x1, z1], y) {
  const g = new PlaneGeometry(x1 - x0, z1 - z0)
  g.rotateX(-Math.PI / 2)
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / TILE, -pos.getZ(i) / TILE)
  return g
}

export function slab([x0, z0, x1, z1], yBottom, yTop) {
  const g = new BoxGeometry(x1 - x0, yTop - yBottom, z1 - z0)
  g.translate((x0 + x1) / 2, (yBottom + yTop) / 2, (z0 + z1) / 2)
  return g
}

// A flat strip whose texture U runs along `dir` (radians, 0 = +X, PI/2 =
// -Z), repeating once every `period` metres — for directional patterns
// like conveyor chevrons.
export function directedStrip(cx, cz, length, width, dir, y, period) {
  const g = new PlaneGeometry(length, width)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * length) / period)
  g.rotateX(-Math.PI / 2)
  g.rotateY(dir)
  g.translate(cx, y, cz)
  return g
}

export function merge(geometries) {
  const merged = mergeGeometries(geometries)
  for (const g of geometries) g.dispose()
  return merged
}
