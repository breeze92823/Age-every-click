import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial } from 'three'
import { MATERIAL_PBR } from '../data/materials.js'
import { GROUND_Y, ISLAND_HEIGHT, ISLAND_SCALE } from '../data/world.js'
import { CORE, EDGE, PATHS, ENCLOSURES, ENCLOSURE_BORDER, CURB_HEIGHT, BED_DEPTH, GRASS_RECTS } from '../data/island.js'
import { makeStudTexture } from '../systems/studTexture.js'
import { makeChevronTexture } from '../systems/canvasTextures.js'
import { flatRect, slab, directedStrip, merge } from '../systems/levelGeometry.js'
import { curbStrips } from '../systems/conveyor.js'
import IslandDecor from './IslandDecor.jsx'
import IslandLandmarks from './IslandLandmarks.jsx'

// The hub island: stepped grass-topped terrain on a sand ledge, grey stud
// plazas, and chevron-curbed grass beds — each surface type merged into one
// mesh. Decor and landmarks sit on top. Purely visual: playerMovement.js
// clamps the player to GROUND_Y directly.
const GRASS_DEPTH = 0.35
// Always reaches 0.6 m below the water once scaled, so a small scale never
// lifts the island's base clear of the surface.
const SAND_BOTTOM = GROUND_Y - (ISLAND_HEIGHT + 0.6) / ISLAND_SCALE
const PATH_Y = GROUND_Y + 0.02
const BED_Y = GROUND_Y + BED_DEPTH
// Texture-space units per second scrolled along each strip's U axis (1 unit
// = one border width), so the chevrons crawl forward like a conveyor belt.
const CHEVRON_SPEED = -0.35

function insetRect([x0, z0, x1, z1], d) {
  return [x0 + d, z0 + d, x1 - d, z1 - d]
}

function buildIsland() {
  const grassRects = GRASS_RECTS
  const sandRects = [CORE, ...EDGE.map((c) => c.sand)]
  const strips = ENCLOSURES.flatMap((r) => curbStrips(r, ENCLOSURE_BORDER))
  const curbTop = GROUND_Y + CURB_HEIGHT

  const grassTexture = makeStudTexture({ light: '#7cc350', dark: '#74b849', repeatX: 1, repeatY: 1 })
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
      material: new MeshStandardMaterial({ color: '#579c33', ...MATERIAL_PBR.ISLAND_SIDE }),
      castShadow: true,
    },
    {
      geometry: merge(sandRects.map((r) => slab(r, SAND_BOTTOM, GROUND_Y - GRASS_DEPTH))),
      material: new MeshStandardMaterial({ color: '#d4bd82', ...MATERIAL_PBR.ISLAND_SIDE }),
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

  return { parts, textures: [grassTexture, pathTexture, chevronTexture], chevronTexture }
}

export default function Island() {
  const island = useMemo(buildIsland, [])

  useFrame((_state, delta) => {
    const t = island.chevronTexture
    t.offset.x = (t.offset.x + delta * CHEVRON_SPEED) % 1
  })

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
    <group scale={ISLAND_SCALE} position-y={GROUND_Y * (1 - ISLAND_SCALE)}>
      {island.parts.map(({ geometry, material, castShadow = false }, i) => (
        <mesh key={i} geometry={geometry} material={material} receiveShadow castShadow={castShadow} />
      ))}
      <IslandDecor />
      <IslandLandmarks />
    </group>
  )
}
