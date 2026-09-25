// No-op: unlike Ice-Skate (which has no localStorage fallback either), this
// project never grew its own localStorage load/save path before systems/
// net.js's real Colyseus connection landed. Progress load/save now goes
// entirely through net.js's progressPayload()/`saveProgress` and the
// `progress` message's useGameStore.getState().hydrate(msg) — a guest (or a
// server-less build) simply starts from useGameStore's defaults every load,
// same as before. Kept as its own module/call site in main.jsx in case a
// real localStorage fallback (for a guest with no account to save against)
// is ever added later.
export function install() {}
