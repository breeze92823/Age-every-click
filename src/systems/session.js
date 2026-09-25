// Room / party identity for invites, ported verbatim from Ice-Skate's
// systems/session.js.
//
// There is no netcode in this project, so this owns the *plumbing* only: it
// reads an incoming ?roomId / ?partyId deep link and mints a room id for
// outgoing invites (components/hud/FriendsPanel.jsx). An invite link
// resolves and launches the scene; actual co-presence needs real netcode.
const listeners = new Set()

export const session = {
  roomId: '',
  partyId: '',
  joinedViaInvite: false,
}

function emit(event, payload) {
  for (const fn of listeners) fn(event, payload)
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function mintRoomId() {
  return `r${Math.random().toString(36).slice(2, 10)}`
}

export function install() {
  let params
  try {
    params = new URLSearchParams(window.location.search)
  } catch {
    params = new URLSearchParams('')
  }
  const incomingRoom = params.get('roomId') || ''
  const incomingParty = params.get('partyId') || ''
  session.joinedViaInvite = !!incomingRoom
  session.roomId = incomingRoom || mintRoomId()
  session.partyId = incomingParty
  emit('room', session)
}

export function setRoom(roomId, partyId = '') {
  session.roomId = roomId
  session.partyId = partyId
  emit('room', session)
}

export function clearRoom() {
  session.roomId = ''
  session.partyId = ''
  emit('room', session)
}
