import { useState } from 'react'
import { authState, getInviteLink, inviteFriend } from '../../systems/bloxity.js'
import { useAuth } from './hooks.js'

// Ported verbatim from Ice-Skate's components/hud/FriendsPanel.jsx.
const PRESENCE_COLOR = {
  online: 'text-emerald-400',
  'in-game': 'text-sky-400',
  away: 'text-amber-400',
  offline: 'text-slate-500',
}

export default function FriendsPanel({ panelStyle }) {
  useAuth()
  const [note, setNote] = useState('')
  const friends = authState.friends

  const onInvite = async (friend) => {
    const ok = await inviteFriend(friend._id)
    setNote(ok ? `Invited ${friend.displayName || friend.username}` : 'Invite failed')
  }

  const onCopyLink = async () => {
    const link = getInviteLink()
    if (!link) return setNote('No link available')
    try {
      await navigator.clipboard.writeText(link)
      setNote('Link copied')
    } catch {
      setNote(link)
    }
  }

  return (
    <div className="mt-2 rounded px-3 py-2" style={panelStyle}>
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-slate-100">Friends</span>
        <button
          type="button"
          onClick={onCopyLink}
          className="rounded bg-slate-100/10 px-2 py-0.5 hover:bg-slate-100/20"
        >
          Copy link
        </button>
      </div>

      {friends.length === 0 && <div className="text-slate-400">No friends online.</div>}

      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {friends.map((friend) => {
          const status = (friend.presence && friend.presence.status) || 'offline'
          return (
            <li key={friend._id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                <span className={PRESENCE_COLOR[status] || PRESENCE_COLOR.offline}>● </span>
                {friend.displayName || friend.username}
              </span>
              <button
                type="button"
                onClick={() => onInvite(friend)}
                className="shrink-0 rounded bg-slate-100/10 px-2 py-0.5 hover:bg-slate-100/20"
              >
                Invite
              </button>
            </li>
          )
        })}
      </ul>

      {note && <div className="mt-1 break-all text-slate-400">{note}</div>}

      <div className="mt-1 text-[10px] leading-tight text-slate-500">
        Invites carry a room id; shared play arrives with multiplayer.
      </div>
    </div>
  )
}
