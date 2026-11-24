import { describe, expect, it } from 'vitest'
import { modifieIlYa } from './dates'

const now = Date.parse('2026-11-24T12:00:00Z')
const il = (ms: number) => modifieIlYa(new Date(now - ms).toISOString(), now)

describe('modifieIlYa', () => {
  it("moins d'une minute", () => expect(il(30_000)).toBe("modifié à l'instant"))
  it('minutes', () => expect(il(5 * 60_000)).toMatch(/^modifié il y a 5 minutes$/))
  it('heures', () => expect(il(3 * 3_600_000)).toMatch(/^modifié il y a 3 heures$/))
  it('jours', () => expect(il(2 * 86_400_000)).toMatch(/^modifié avant-hier$|^modifié il y a 2 jours$/))
  it('mois', () => expect(il(65 * 86_400_000)).toBe('modifié il y a 2 mois'))
  it('années', () => expect(il(800 * 86_400_000)).toBe('modifié il y a 2 ans'))
})
