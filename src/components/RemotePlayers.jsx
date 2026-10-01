import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import { subscribeRoster } from '../systems/net.js'
import { attachEquippedAccessories, applyProportions } from '../systems/avatarLoader.js'
import { buildDefaultCharacter } from '../systems/defaultCharacter.js'
import { makeGait, updateGait, disposeGait } from '../systems/avatarAnim.js'
import { updateHair } from '../systems/hairPhysics.js'
import Nametag from './Nametag.jsx'

const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const _targetPos = new Vector3()
// Same easing shape as components/Player.jsx's own TURN_RATE, applied to
// position too: systems/net.js only relays a network sample every
// MOVE_SEND_INTERVAL_MS, so this smooths the gap between samples instead of
// a remote character snapping/teleporting on every packet.
const LERP_RATE = 0.0008

function parseAvatar(raw) {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

// One other connected session: rebuilds the exact same kind of character
// components/Player.jsx builds for the local player (game's own default
// body + outfit, dressed with whatever Bloxity hat/back accessory the
// sender has equipped) whenever their `avatar` payload changes, and every
// frame reads position/yaw/moveBlend straight off `p` — systems/net.js keeps
// those fields patched in place as `move` packets arrive, no callback needed.
function RemotePlayer({ p, scene }) {
  const ref = useRef()
  const gaitRef = useRef(null)
  const posRef = useRef(null)
  const [avatar, setAvatar] = useState(null)
  const [avatarRaw, setAvatarRaw] = useState(p.avatar)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function build() {
      const parsed = parseAvatar(avatarRaw) || {}
      const group = buildDefaultCharacter(parsed.outfit, parsed.gender ?? 'boy')
      await attachEquippedAccessories(group, parsed.equipped || null, { signal: controller.signal })
      if (cancelled) return
      applyProportions(group, parsed.proportions || null)
      setAvatar(group)
    }
    build()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [avatarRaw])

  // Rebuilt per loaded avatar — the gait's cached bind-pose quaternions
  // (see avatarAnim.js) belong to one specific rig instance.
  useEffect(() => {
    gaitRef.current = null
    if (!avatar) return
    gaitRef.current = makeGait({ root: avatar, nodes: avatar.nodes || {}, clips: avatar.animations || [] })
    return () => {
      disposeGait(gaitRef.current)
      gaitRef.current = null
    }
  }, [avatar])

  useFrame((state, delta) => {
    // The schema instance's own fields patch in place as `move`/`setAvatar`
    // packets land — a plain per-frame compare is all a human-speed change
    // like a new outfit or equip needs (the position/yaw/moveBlend reads
    // below are the ones that matter every single frame).
    if (p.avatar !== avatarRaw) setAvatarRaw(p.avatar)

    const g = ref.current
    if (!g) return
    // Only render this session alongside players who are actually sharing
    // the current scene/instance right now (systems/net.js's `scene` field
    // on PlayerState) — an island player must never appear to be standing
    // on the separately-located Impossible Bridge, or vice versa.
    const visible = p.scene === scene
    g.visible = visible
    if (!visible) return
    if (!posRef.current) posRef.current = new Vector3(p.x, p.y, p.z)
    posRef.current.lerp(_targetPos.set(p.x, p.y, p.z), 1 - Math.pow(LERP_RATE, delta))
    g.position.copy(posRef.current)
    _targetQuat.setFromAxisAngle(_up, p.yaw)
    g.quaternion.slerp(_targetQuat, 1 - Math.pow(LERP_RATE, delta))

    const gait = gaitRef.current
    if (gait) updateGait(gait, Math.min(delta, 0.1), p.moveBlend, true)
    // After the gait has posed the head, so the hair follows this frame's pose.
    if (avatar) updateHair(avatar, delta, state.clock.elapsedTime)
  })

  return (
    <group ref={ref}>
      {avatar && <primitive object={avatar} />}
      <Nametag getName={() => p.username} getAge={() => p.speed} />
    </group>
  )
}

// Mounts one RemotePlayer per other connected session (systems/net.js's
// subscribeRoster()) — every player in the shared room except ourselves.
// `scene` is the LOCAL player's current scene; each RemotePlayer stays
// mounted (so its avatar/gait persist across a scene switch either side)
// but only renders while the remote session reports the same scene.
export default function RemotePlayers({ scene }) {
  const [ids, setIds] = useState(() => [])
  const playersRef = useRef(new Map())

  useEffect(() => {
    return subscribeRoster(
      (sessionId, p) => {
        playersRef.current.set(sessionId, p)
        setIds(Array.from(playersRef.current.keys()))
      },
      (sessionId) => {
        playersRef.current.delete(sessionId)
        setIds(Array.from(playersRef.current.keys()))
      },
    )
  }, [])

  return (
    <>
      {ids.map((id) => {
        const p = playersRef.current.get(id)
        return p ? <RemotePlayer key={id} p={p} scene={scene} /> : null
      })}
    </>
  )
}
