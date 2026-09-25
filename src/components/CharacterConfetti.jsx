import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { player } from '../systems/playerState.js'

// Party-popper confetti burst played when the player's character changes.
// Particles live in world space (they don't follow the player once fired) and
// share one InstancedMesh, so a dense burst is still a single draw call.
// Two emitters fire together:
//  - poppers: jets from around the feet, shooting up through the body,
//  - shell: pieces spawned over the whole body surface, flung outward,
// so the character is fully engulfed for the first half-second.

const MAX = 1400
const POPPERS = 6
const POPPER_SHARE = 0.55
const GRAVITY = 7
const DRAG = 1.6 // velocity damping per second (flutter-y confetti falls slow)
const COLORS = ['#ff3b6b', '#ffd23f', '#3bceac', '#4d7cff', '#b45cff', '#ff8a3d', '#ffffff', '#5cff7a'].map(
  (c) => new Color(c),
)

const listeners = new Set()

// Fire a burst at the player's current position.
export function burstConfetti() {
  for (const fn of listeners) fn()
}

const _dummy = new Object3D()
const _q = new Quaternion()
const _axis = new Vector3()

export default function CharacterConfetti() {
  const { mesh, parts } = useMemo(() => {
    const geo = new PlaneGeometry(0.07, 0.04)
    const mat = new MeshBasicMaterial({ side: DoubleSide, toneMapped: false, transparent: true })
    const m = new InstancedMesh(geo, mat, MAX)
    m.frustumCulled = false
    m.visible = false
    m.count = 0
    for (let i = 0; i < MAX; i++) m.setColorAt(i, COLORS[0])
    const p = Array.from({ length: MAX }, () => ({
      pos: new Vector3(),
      vel: new Vector3(),
      rot: new Quaternion(),
      spinAxis: new Vector3(),
      spin: 0,
      age: 0,
      life: 0,
      scale: 1,
      flutter: 0,
    }))
    return { mesh: m, parts: p }
  }, [])

  useEffect(() => {
    const fire = () => {
      const h = player.dims.height
      const r = player.dims.radius
      const { x, y, z } = player.position
      const phase = Math.random() * Math.PI * 2
      for (let i = 0; i < MAX; i++) {
        const p = parts[i]
        if (i < MAX * POPPER_SHARE) {
          // Popper jet: nozzle on a ring round the feet, cone aimed up and
          // slightly inward so the stream sweeps up the body.
          const k = i % POPPERS
          const a = phase + (k / POPPERS) * Math.PI * 2
          const nx = Math.cos(a)
          const nz = Math.sin(a)
          p.pos.set(x + nx * (r + 0.25), y + 0.1, z + nz * (r + 0.25))
          const spread = 0.45
          const up = 5.5 + Math.random() * 4.5
          const out = -0.4 + (Math.random() - 0.5) * spread * 2 + Math.random() * 1.6
          p.vel.set(
            nx * out + (Math.random() - 0.5) * spread * 3,
            up,
            nz * out + (Math.random() - 0.5) * spread * 3,
          )
        } else {
          // Shell: anywhere on/around the body, flung outward and up.
          const a = Math.random() * Math.PI * 2
          const rr = r * (0.3 + Math.random() * 0.9)
          const hy = Math.random() * h * 1.1
          const nx = Math.cos(a)
          const nz = Math.sin(a)
          p.pos.set(x + nx * rr, y + hy, z + nz * rr)
          const speed = 1.5 + Math.random() * 3.5
          p.vel.set(nx * speed, 1.5 + Math.random() * 3.5, nz * speed)
        }
        p.rot.setFromAxisAngle(_axis.randomDirection(), Math.random() * Math.PI * 2)
        p.spinAxis.randomDirection()
        p.spin = 6 + Math.random() * 14
        p.age = -Math.random() * 0.12 // tiny stagger so it reads as a pop, not a flash
        p.life = 1.6 + Math.random() * 1.2
        p.scale = 0.7 + Math.random() * 0.8
        p.flutter = Math.random() * Math.PI * 2
        mesh.setColorAt(i, COLORS[(Math.random() * COLORS.length) | 0])
      }
      mesh.instanceColor.needsUpdate = true
      mesh.count = MAX
      mesh.visible = true
    }
    listeners.add(fire)
    return () => listeners.delete(fire)
  }, [mesh, parts])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  useFrame((state, delta) => {
    if (!mesh.visible) return
    const dt = Math.min(delta, 0.05)
    const damp = Math.exp(-DRAG * dt)
    const t = state.clock.elapsedTime
    let alive = 0
    for (let i = 0; i < mesh.count; i++) {
      const p = parts[i]
      p.age += dt
      let s = 0
      if (p.age >= 0 && p.age < p.life) {
        alive++
        p.vel.multiplyScalar(damp)
        p.vel.y -= GRAVITY * dt
        // Falling paper drifts side to side instead of dropping straight.
        if (p.vel.y < 0) {
          p.vel.y = Math.max(p.vel.y, -2.2)
          p.vel.x += Math.sin(t * 7 + p.flutter) * 2.5 * dt
          p.vel.z += Math.cos(t * 6 + p.flutter) * 2.5 * dt
        }
        p.pos.addScaledVector(p.vel, dt)
        _q.setFromAxisAngle(p.spinAxis, p.spin * dt)
        p.rot.multiply(_q)
        const fade = Math.min(1, (p.life - p.age) / 0.35)
        s = p.scale * fade
      } else if (p.age < 0) {
        alive++
      }
      _dummy.position.copy(p.pos)
      _dummy.quaternion.copy(p.rot)
      _dummy.scale.setScalar(s)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (!alive) {
      mesh.visible = false
      mesh.count = 0
    }
  })

  return <primitive object={mesh} />
}
