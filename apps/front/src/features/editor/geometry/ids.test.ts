import { describe, expect, it } from 'vitest'
import { newId } from './ids'

describe('newId', () => {
  it('génère 1000 ids uniques, jamais stairs, <= 64 caractères', () => {
    const existing = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const id = newId('r', existing)
      expect(existing.has(id)).toBe(false)
      expect(id).not.toBe('stairs')
      expect(id.length).toBeLessThanOrEqual(64)
      expect(id).toMatch(/^r[0-9a-z]{8}$/)
      existing.add(id)
    }
  })
})
