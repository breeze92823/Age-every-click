// Secondary-motion physics for long hair and beards on the default
// characters (systems/defaultCharacter.js). Framework-free: components/
// Player.jsx ticks it each frame after the walk cycle has posed the rig.
//
// Each strand is a skinned mesh riding a chain of bones hung off the head.
// A Verlet particle sits on every joint: the first is pinned to the head,
// the rest are damped springs pulling toward the strand's modelled shape,
// stiff near the head and loose at the tip. The modelled shape already
// hangs under gravity, so gravity is folded into that spring: what moves
// the hair is inertia and air — it trails behind a run, swings on a stop or
// a turn, floats up through a jump (the body is in free fall, as real hair
// does) and bounces on landing, and drifts in a light breeze. Particles are
// held at their segment lengths and kept off the front or back of the body,
// then each bone is rotated to point at the next particle.
//
// All of it is null-safe: a character without strands has `root.hair`
// unset and updateHair() is a no-op.
import { Matrix4, Quaternion, Vector3 } from 'three'

export const HAIR = {
  rootFreq: 14, // rad/s, spring back to the modelled shape near the head…
  tipFreq: 5, // …easing off toward the tip, which moves most freely
  damping: 2.2, // 1/s, how fast a swing dies out (relative to the head)
  airDrag: 1.3, // 1/s, drag against moving through the air: the run trail
  iterations: 4, // length-constraint passes per frame
  wind: 2.5, // m/s², breeze strength
  windHz: 0.8, // breeze gusting speed
  maxDt: 1 / 30, // clamp so a hitch can't fling the hair
  snapDistance: 3, // m, anchor jump treated as a teleport (respawn) -> reset
}

const _q = new Quaternion()
const _parentQ = new Quaternion()
const _invRoot = new Matrix4()
const _v = new Vector3()
const _d = new Vector3()

// Describe one strand for the simulation. `bones` is the chain from the
// head-pinned root to the tip (rest rotations identity), `rest` their rest
// positions in the chain parent's (the head bone's) space, and `side`/`body`
// which face of the body it hangs over: side +1 front / -1 back, body the
// root-local |z| (rig units) its centreline must stay beyond.
export function makeStrand(bones, rest, side, body) {
  const n = bones.length
  return {
    bones,
    rest,
    side,
    body,
    // Direction from each joint to the next in its own bone's frame.
    restDir: rest.slice(1).map((p, i) => p.clone().sub(rest[i]).normalize()),
    pos: rest.map(() => new Vector3()),
    prev: rest.map(() => new Vector3()),
    restWorld: rest.map(() => new Vector3()),
    restPrev: rest.map(() => new Vector3()),
    phase: Math.random() * 10,
    ready: false,
    n,
  }
}

function resetStrand(s) {
  for (let i = 0; i < s.n; i++) {
    s.pos[i].copy(s.restWorld[i])
    s.prev[i].copy(s.restWorld[i])
    s.restPrev[i].copy(s.restWorld[i])
  }
  s.ready = true
}

// root: the character Group, carrying `root.hair` (array of strands).
export function updateHair(root, dt, time) {
  const strands = root && root.hair
  if (!strands || !strands.length || dt <= 0) return
  dt = Math.min(dt, HAIR.maxDt)

  root.updateWorldMatrix(true, true)
  _invRoot.copy(root.matrixWorld).invert()
  const dt2 = dt * dt

  for (const s of strands) {
    const head = s.bones[0].parent
    for (let i = 0; i < s.n; i++) s.restWorld[i].copy(s.rest[i]).applyMatrix4(head.matrixWorld)

    if (!s.ready || s.pos[0].distanceTo(s.restWorld[0]) > HAIR.snapDistance) resetStrand(s)

    // Integrate (Verlet, velocities as per-frame displacements): a damped
    // spring toward the modelled shape, drag against the air, and a breeze.
    s.pos[0].copy(s.restWorld[0])
    s.prev[0].copy(s.restWorld[0])
    const w = HAIR.wind * dt2
    for (let i = 1; i < s.n; i++) {
      const p = s.pos[i]
      const t = i / (s.n - 1)
      const freq = HAIR.rootFreq + (HAIR.tipFreq - HAIR.rootFreq) * t
      _v.subVectors(p, s.prev[i]) // this joint's motion last frame
      _d.subVectors(s.restWorld[i], s.restPrev[i]) // its rest point's motion
      s.prev[i].copy(p)
      p.add(_v)
      p.addScaledVector(_v.sub(_d), -HAIR.damping * dt)
      p.addScaledVector(_d.add(_v), -HAIR.airDrag * dt) // _d + (_v - _d) = own motion
      _d.subVectors(s.restWorld[i], p)
      p.addScaledVector(_d, freq * freq * dt2)
      p.x += Math.sin(time * HAIR.windHz * 2.1 + s.phase + i * 0.6) * w * t
      p.z += Math.sin(time * HAIR.windHz * 1.3 + s.phase * 0.7 + i * 0.4) * w * t
    }
    for (let i = 0; i < s.n; i++) s.restPrev[i].copy(s.restWorld[i])

    // Hold segment lengths (the rest lengths, already in world scale), then
    // keep the strand on its side of the body.
    for (let it = 0; it < HAIR.iterations; it++) {
      for (let i = 1; i < s.n; i++) {
        const a = s.pos[i - 1]
        const b = s.pos[i]
        const len = s.restWorld[i].distanceTo(s.restWorld[i - 1])
        _d.subVectors(b, a)
        const dist = _d.length() || 1e-6
        const diff = (dist - len) / dist
        if (i === 1) b.addScaledVector(_d, -diff)
        else {
          a.addScaledVector(_d, diff * 0.5)
          b.addScaledVector(_d, -diff * 0.5)
        }
      }
      for (let i = 1; i < s.n; i++) {
        _v.copy(s.pos[i]).applyMatrix4(_invRoot)
        if (_v.z * s.side < s.body) {
          _v.z = s.body * s.side
          s.pos[i].copy(_v).applyMatrix4(root.matrixWorld)
        }
      }
    }

    // Pose the chain: each bone turns to aim at the next particle.
    head.getWorldQuaternion(_parentQ)
    for (let i = 0; i < s.n - 1; i++) {
      _d.subVectors(s.pos[i + 1], s.pos[i]).normalize()
      _q.copy(_parentQ).invert()
      _d.applyQuaternion(_q)
      const bone = s.bones[i]
      bone.quaternion.setFromUnitVectors(s.restDir[i], _d)
      _parentQ.multiply(bone.quaternion)
    }
  }
}

// Snap every strand back to rest (e.g. after the avatar is rebuilt).
export function resetHair(root) {
  if (root && root.hair) for (const s of root.hair) s.ready = false
}
