import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y, WATER_Y } from '../data/world.js'
import { CORE, EDGE, PATHS, ENCLOSURES, ENCLOSURE_BORDER } from '../data/island.js'
import { makeStudTexture } from '../systems/studTexture.js'
import { makeChevronTexture } from '../systems/canvasTextures.js'
import { flatRect, slab, directedStrip, merge } from '../systems/levelGeometry.js'
import IslandDecor from './IslandDecor.jsx'
import IslandLandmarks from './IslandLandmarks.jsx'

// The hub island: stepped grass-topped terrain on a sand ledge, grey stud
// plazas, and chevron-curbed grass beds — each surface type merged into one
// mesh. Decor and landmarks sit on top. Purely visual: playerMovement.js
// clamps the player to GROUND_Y directly.
const GRASS_DEPTH = 0.35
const SAND_BOTTOM = WATER_Y - 0.6
const PATH_Y = GROUND_Y + 0.02
const BED_Y = GROUND_Y + 0.03
const CURB_HEIGHT = 0.14

function insetRect([x0, z0, x1, z1], d) {
  return [x0 + d, z0 + d, x1 - d, z1 - d]
}

// The curb as a pinwheel of four non-overlapping strips, so the chevrons on
// top never z-fight at the corners. Directions run clockwise seen from above.
function curbStrips([x0, z0, x1, z1], b) {
  return [
    { rect: [x0, z0, x1 - b, z0 + b], dir: 0 },
    { rect: [x1 - b, z0, x1, z1 - b], dir: -Math.PI / 2 },
    { rect: [x0 + b, z1 - b, x1, z1], dir: Math.PI },
    { rect: [x0, z0 + b, x0 + b, z1], dir: Math.PI / 2 },
  ]
}

function buildIsland() {
  const grassRects = [CORE, ...EDGE.filter((c) => c.grass).map((c) => c.grass)]
  const sandRects = [CORE, ...EDGE.map((c) => c.sand)]
  const strips = ENCLOSURES.flatMap((r) => curbStrips(r, ENCLOSURE_BORDER))
  const curbTop = GROUND_Y + CURB_HEIGHT

  const grassTexture = makeStudTexture({ light: '#8fd84e', dark: '#86cf47', repeatX: 1, repeatY: 1 })
  const pathTexture = makeStudTexture({ light: '#cfd2d8', dark: '#c6c9d0', repeatX: 1, repeatY: 1 })
  const chevronTexture = makeChevronTexture({ color: '#8d929c', background: '#484c55' })

  const grassMaterial = new MeshStandardMaterial({ map: grassTexture, ...MATERIAL_PBR.ISLAND_TOP })
  const parts = [
    {
      geometry: merge([
        ...grassRects.map((r) => flatRect(r, GROUND_Y)),
        ...ENCLOSURES.map((r) => flatRect(insetRect(r, ENCLOSURE_BORDER), BED_Y)),
      ]),
      material: grassMaterial,
    },
    {
      geometry: merge(grassRects.map((r) => slab(r, GROUND_Y - GRASS_DEPTH, GROUND_Y - 0.005))),
      material: new MeshStandardMaterial({ color: '#63b536', ...MATERIAL_PBR.ISLAND_SIDE }),
      castShadow: true,
    },
    {
      geometry: merge(sandRects.map((r) => slab(r, SAND_BOTTOM, GROUND_Y - GRASS_DEPTH))),
      material: new MeshStandardMaterial({ color: '#e2cc8f', ...MATERIAL_PBR.ISLAND_SIDE }),
    },
    {
      geometry: merge(PATHS.map((r) => flatRect(r, PATH_Y))),
      material: new MeshStandardMaterial({ map: pathTexture, ...MATERIAL_PBR.PATH }),
    },
    {
      geometry: merge(strips.map((s) => slab(s.rect, GROUND_Y, curbTop - 0.005))),
      material: new MeshStandardMaterial({ color: '#3f434b', ...MATERIAL_PBR.PATH }),
      castShadow: true,
    },
    {
      geometry: merge(
        strips.map(({ rect: [x0, z0, x1, z1], dir }) => {
          const alongX = dir === 0 || dir === Math.PI
          const length = alongX ? x1 - x0 : z1 - z0
          const cx = (x0 + x1) / 2
          const cz = (z0 + z1) / 2
          return directedStrip(cx, cz, length, ENCLOSURE_BORDER, dir, curbTop, ENCLOSURE_BORDER)
        }),
      ),
      material: new MeshStandardMaterial({ map: chevronTexture, ...MATERIAL_PBR.PATH }),
    },
  ]

  return { parts, textures: [grassTexture, pathTexture, chevronTexture] }
}

export default function Island() {
  const island = useMemo(buildIsland, [])

  // three.js does not GC GPU memory.
  useEffect(
    () => () => {
      for (const { geometry, material } of island.parts) {
        geometry.dispose()
        material.dispose()
      }
      for (const t of island.textures) t.dispose()
    },
    [island],
  )

  return (
    <group>
      {island.parts.map(({ geometry, material, castShadow = false }, i) => (
        <mesh key={i} geometry={geometry} material={material} receiveShadow castShadow={castShadow} />
      ))}
      <IslandDecor />
      <IslandLandmarks />
    </group>
  )
}
