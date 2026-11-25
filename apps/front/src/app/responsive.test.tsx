import { describe, expect, it } from 'vitest'

const feuilles = import.meta.glob<string>(['../**/*.module.css', '../styles/global.css'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('responsive (lecture des feuilles de style)', () => {
  it('lit bien les feuilles de style', () => {
    expect(Object.keys(feuilles).length).toBeGreaterThan(10)
    expect(Object.keys(feuilles).some((f) => f.endsWith('global.css'))).toBe(true)
  })

  it('aucune width / min-width fixe en px supérieure à 360', () => {
    const fautifs: string[] = []
    for (const [fichier, brut] of Object.entries(feuilles)) {
      // Les conditions des at-rules (`@media (min-width: 900px) {`) ne sont pas des déclarations.
      const css = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(media|container|supports)[^{;]*/g, '')
      for (const m of css.matchAll(/(?<![\w-])(min-width|width)\s*:\s*(\d+(?:\.\d+)?)px/g)) {
        if (Number(m[2]) > 360) fautifs.push(`${fichier} : ${m[0]}`)
      }
    }
    expect(fautifs).toEqual([])
  })
})
