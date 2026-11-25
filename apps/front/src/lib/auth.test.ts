import { describe, expect, it } from 'vitest'
import { cheminSuite } from './auth'

describe('cheminSuite', () => {
  it('accepte un chemin interne', () => {
    expect(cheminSuite('/projets/1?x=2')).toBe('/projets/1?x=2')
  })
  it.each([null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/\\evil.com', '/\t/evil.com', '/a\nb', 'projets'])(
    'retombe sur /projets pour %s',
    (valeur) => {
      expect(cheminSuite(valeur)).toBe('/projets')
    },
  )
})
