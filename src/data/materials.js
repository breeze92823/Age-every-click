// Shared roughness/metalness lookup table — every MeshStandardMaterial
// spreads one of these in rather than typing PBR values inline at the call
// site. Add one entry per new prop type as the game grows.
export const MATERIAL_PBR = {
  GROUND: { roughness: 0.9, metalness: 0 },
  PLAYER: { roughness: 0.7, metalness: 0 },
}
