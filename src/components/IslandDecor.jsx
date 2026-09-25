import { useEffect, useMemo } from 'react'
import { BoxGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y } from '../data/world.js'
import { TREES, BUSHES, ROCKS, FLOWERS } from '../data/island.js'

// Every tree, bush, rock and flower on the island is built from coloured
// boxes, so they all share one InstancedMesh — a single draw call. A box is
// { p: centre [x, y, z], s: size [w, h, d], r: yaw, c: colour }.

// [width, height] per tier, trunk first. At scale 1 a tree stands 3.7 m,
// about twice the 1.8 m player.
const TREE_TIERS = [
  [0.45, 0.7],
  [2.6, 0.9],
  [1.9, 0.85],
  [1.25, 0.8],
  [0.55, 0.45],
]
const TRUNK = '#7e5230'
const LEAVES_LIGHT = ['#65b83a', '#5aae33']
const LEAVES_DARK = ['#398930', '#317b29']
const BUSH = ['#78c944', '#6cbd3c']
const ROCK = ['#989ba4', '#84888f']
const PETALS = ['#ff4d4d', '#4d8bff', '#ffd23d', '#ffffff', '#ff7ad9']
const STEM = '#4f9e2c'

// Tiers alternate 45 degrees, giving the stepped, spiky conifer silhouette.
function tree({ x, z, yaw, scale, variant }, out) {
  const leaves = variant < 0.5 ? LEAVES_LIGHT : LEAVES_DARK
  let y = GROUND_Y
  TREE_TIERS.forEach(([w, h], i) => {
    out.push({
      p: [x, y + (h * scale) / 2, z],
      s: [w * scale, h * scale, w * scale],
      r: yaw + (i % 2) * (Math.PI / 4),
      c: i === 0 ? TRUNK : leaves[i % 2],
    })
    y += h * scale
  })
}

function bush({ x, z, yaw, scale }, out) {
  out.push({ p: [x, GROUND_Y + 0.35 * scale, z], s: [1.5 * scale, 0.7 * scale, 1.5 * scale], r: yaw, c: BUSH[0] })
  out.push({
    p: [x, GROUND_Y + 0.95 * scale, z],
    s: [0.9 * scale, 0.5 * scale, 0.9 * scale],
    r: yaw + Math.PI / 4,
    c: BUSH[1],
  })
}

function rock({ x, z, yaw, scale, variant }, out) {
  const h = (0.5 + variant * 0.3) * scale
  out.push({ p: [x, GROUND_Y + h / 2, z], s: [1.1 * scale, h, 0.9 * scale], r: yaw, c: ROCK[0] })
  out.push({
    p: [x + 0.6 * Math.cos(yaw), GROUND_Y + 0.2 * scale, z - 0.6 * Math.sin(yaw)],
    s: [0.6 * scale, 0.4 * scale, 0.55 * scale],
    r: yaw + 0.5,
    c: ROCK[1],
  })
}

// A little clump of three flowers around the placement point.
function flowers({ x, z, yaw, variant }, out) {
  for (let i = 0; i < 3; i++) {
    const a = yaw + (i * Math.PI * 2) / 3
    const fx = x + Math.cos(a) * 0.25
    const fz = z + Math.sin(a) * 0.25
    out.push({ p: [fx, GROUND_Y + 0.15, fz], s: [0.06, 0.3, 0.06], r: 0, c: STEM })
    out.push({
      p: [fx, GROUND_Y + 0.33, fz],
      s: [0.2, 0.12, 0.2],
      r: a,
      c: PETALS[Math.floor(variant * PETALS.length + i) % PETALS.length],
    })
  }
}

function buildDecorBoxes() {
  const out = []
  for (const t of TREES) tree(t, out)
  for (const b of BUSHES) bush(b, out)
  for (const r of ROCKS) rock(r, out)
  for (const f of FLOWERS) flowers(f, out)
  return out
}

export default function IslandDecor() {
  const mesh = useMemo(() => {
    const boxes = buildDecorBoxes()
    const m = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial(MATERIAL_PBR.DECOR),
      boxes.length,
    )
    const dummy = new Object3D()
    const color = new Color()
    boxes.forEach((b, i) => {
      dummy.position.set(...b.p)
      dummy.rotation.set(0, b.r, 0)
      dummy.scale.set(...b.s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      m.setColorAt(i, color.set(b.c))
    })
    m.castShadow = true
    m.receiveShadow = true
    m.computeBoundingSphere()
    return m
  }, [])

  // three.js does not GC GPU memory.
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  return <primitive object={mesh} />
}
