import type { Room } from '@digimmo/domain'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => ALPHABET[b % 36]).join('')
}

/** Identifiant `prefix` + 8 caractères base36, unique dans `existing` et jamais « stairs ». */
export function newId(prefix: 'r' | 'o' | 'f', existing: Set<string>): string {
  for (;;) {
    const id = prefix + randomSuffix()
    if (id !== 'stairs' && !existing.has(id)) return id
  }
}

/** « Pièce N » avec le premier numéro libre. */
export function nextRoomName(rooms: Room[]): string {
  const used = new Set(rooms.map((r) => r.name))
  let n = 1
  while (used.has(`Pièce ${n}`)) n++
  return `Pièce ${n}`
}
