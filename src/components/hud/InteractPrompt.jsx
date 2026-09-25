import { useInteractPrompt } from '../../systems/interactPrompt.js'

// Bottom-center "Press E to ..." pill for the island's obby entry pads
// (Impossible Bridge, Stud Jumps, Tsunami Escape) — systems/scenePortals.js
// arms the label via setInteractPrompt while the player stands on a pad, and
// clears it once E is pressed or the player steps off. Ported in spirit from
// Ice-Skate's InteractPrompt, without its 2s hold-ring (these pads fire
// instantly on press).
export default function InteractPrompt() {
  const label = useInteractPrompt((s) => s.label)

  if (!label) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-30 flex justify-center">
      <div
        className="flex items-center gap-2 rounded-full border-2 border-black bg-black/70 px-5 py-2"
        style={{ WebkitTextStroke: '1px black', paintOrder: 'stroke fill' }}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-white bg-slate-700 text-sm font-black text-white">
          E
        </span>
        <span className="font-black text-white">{label}</span>
      </div>
    </div>
  )
}
