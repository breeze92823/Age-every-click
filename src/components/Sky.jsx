import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, ShaderMaterial, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Gradient sky dome plus blocky clouds, replacing the flat background colour.
// The dome is unlit and ignores fog, and follows the camera so the horizon
// never moves. `colors` is { top, mid, bottom }; `bottom` should match the
// scene fog so distant geometry melts into the horizon.
const DOME_RADIUS = 420
const CLOUD_COUNT = 26

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Each cloud is a row of boxes bulging in the middle, with a slightly
// darker underside layer. All clouds merge into two meshes.
function buildClouds() {
  const random = seeded(20260926)
  const tops = []
  const bases = []
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const angle = random() * Math.PI * 2
    const dist = 110 + random() * 260
    const cx = Math.cos(angle) * dist
    const cz = Math.sin(angle) * dist
    const cy = 75 + random() * 70
    const scale = 7 + random() * 10
    const blocks = 5 + Math.floor(random() * 4)
    for (let b = 0; b < blocks; b++) {
      const t = b / (blocks - 1)
      const bulge = Math.sin(t * Math.PI)
      const w = scale * (1.1 + bulge * 1.5 + random() * 0.4)
      const h = scale * (0.5 + bulge * 0.55)
      const d = scale * (1 + bulge * 1.2 + random() * 0.4)
      const x = cx + (t - 0.5) * scale * 4.2
      const y = cy + bulge * scale * 0.35 + (random() - 0.5) * scale * 0.2
      const z = cz + (random() - 0.5) * scale * 1.2
      const top = new BoxGeometry(w, h, d)
      top.translate(x, y, z)
      tops.push(top)
      const base = new BoxGeometry(w * 1.04, h * 0.32, d * 1.04)
      base.translate(x, y - h * 0.62, z)
      bases.push(base)
    }
  }
  const merge = (parts) => {
    const merged = mergeGeometries(parts, false)
    for (const p of parts) p.dispose()
    return merged
  }
  return { top: merge(tops), base: merge(bases) }
}

export default function Sky({ colors }) {
  const camera = useThree((s) => s.camera)
  const group = useRef()

  const dome = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          topColor: { value: new Color() },
          midColor: { value: new Color() },
          bottomColor: { value: new Color() },
        },
        vertexShader: `
          varying float vHeight;
          void main() {
            vHeight = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 bottomColor;
          varying float vHeight;
          void main() {
            float h = clamp(vHeight, -1.0, 1.0);
            vec3 sky = mix(midColor, topColor, clamp(h * 1.4, 0.0, 1.0));
            vec3 low = mix(bottomColor, midColor, clamp((h + 0.3) * 3.0, 0.0, 1.0));
            gl_FragColor = vec4(h > 0.0 ? sky : low, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )
  const clouds = useMemo(buildClouds, [])
  const cloudTopMat = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', fog: false }), [])
  const cloudBaseMat = useMemo(() => new MeshBasicMaterial({ color: '#d9e8f7', fog: false }), [])
  const domeGeometry = useMemo(() => new SphereGeometry(DOME_RADIUS, 24, 16), [])

  useEffect(() => {
    dome.uniforms.topColor.value.set(colors.top)
    dome.uniforms.midColor.value.set(colors.mid)
    dome.uniforms.bottomColor.value.set(colors.bottom)
  }, [dome, colors])

  useFrame(() => {
    if (group.current) group.current.position.copy(camera.position)
  })

  // three.js does not GC GPU memory.
  useEffect(
    () => () => {
      dome.dispose()
      domeGeometry.dispose()
      clouds.top.dispose()
      clouds.base.dispose()
      cloudTopMat.dispose()
      cloudBaseMat.dispose()
    },
    [dome, domeGeometry, clouds, cloudTopMat, cloudBaseMat],
  )

  return (
    <group ref={group} renderOrder={-2}>
      <mesh geometry={domeGeometry} material={dome} frustumCulled={false} renderOrder={-2} />
      <mesh geometry={clouds.top} material={cloudTopMat} frustumCulled={false} renderOrder={-1} />
      <mesh geometry={clouds.base} material={cloudBaseMat} frustumCulled={false} renderOrder={-1} />
    </group>
  )
}
