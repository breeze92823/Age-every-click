import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { makeTierLabelTexture } from '../systems/canvasTextures.js'
import { formatShort } from '../data/format.js'
import { player } from '../systems/playerState.js'

// A floating name + Age tag above every character — the local player's own
// (components/Player.jsx) and every other connected session's (components/
// RemotePlayers.jsx) — so it's always clear who's who in the shared island.
// A plain THREE.Sprite: always faces the camera with no extra per-frame
// code, same "no drei <Html>, no extra renderer" convention as every other
// piece of in-world text here (systems/canvasTextures.js already draws
// every board/sign/label onto a canvas texture, not a DOM/troika overlay).
const NAMETAG_Y = player.dims.height + 0.4
const NAMETAG_WORLD_HEIGHT = 0.5

// Age (store/useGameStore.js's `speed`) can change many times a second
// while a player clicks — same "not a per-click packet" restraint
// systems/net.js already applies to the multiplayer stats relay, just
// local to this component: repainting the canvas + re-uploading the
// texture on every single click would be wasted work for a tag nobody
// reads that precisely anyway.
const REPAINT_INTERVAL_MS = 1000

// `getName`/`getAge` are getters, not props, so this never re-renders (or
// forces its caller to) on every store/schema change — same pull-based
// reasoning as reading `player`/a remote PlayerState's fields directly in a
// frame loop instead of subscribing to them.
export default function Nametag({ getName, getAge }) {
  const spriteRef = useRef()
  const lastLabel = useRef('')
  const accumMs = useRef(0)
  const textureRef = useRef(null)

  function repaint() {
    const name = getName() || 'Player'
    const ageLine = `Age ${formatShort(Math.max(0, Number(getAge()) || 0))}`
    const label = `${name}\n${ageLine}`
    if (label === lastLabel.current) return
    lastLabel.current = label

    const { texture, aspect } = makeTierLabelTexture(name, ageLine, { px: 96 })
    const prevTexture = textureRef.current
    textureRef.current = texture
    const sprite = spriteRef.current
    if (sprite) {
      sprite.material.map = texture
      sprite.material.needsUpdate = true
      sprite.scale.set(NAMETAG_WORLD_HEIGHT * aspect, NAMETAG_WORLD_HEIGHT, 1)
    }
    if (prevTexture) prevTexture.dispose()
  }

  useEffect(() => {
    repaint()
    return () => {
      if (textureRef.current) textureRef.current.dispose()
    }
    // Paint once on mount; useFrame below re-paints on its own cadence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((state, delta) => {
    accumMs.current += delta * 1000
    if (accumMs.current < REPAINT_INTERVAL_MS) return
    accumMs.current = 0
    repaint()
  })

  return (
    <sprite ref={spriteRef} position={[0, NAMETAG_Y, 0]}>
      <spriteMaterial transparent depthWrite={false} />
    </sprite>
  )
}
