import { describe, expect, it } from 'vitest'
import css from './tokens.css?raw'

const NOMS = [
  'papier',
  'papier-2',
  'trait',
  'encre',
  'encre-2',
  'sanguine',
  'sauge',
  'ocre',
  'blanc',
] as const

function couleur(nom: string): string {
  const m = css.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})\\b`))
  if (!m) throw new Error(`Token --${nom} introuvable`)
  return m[1]
}

function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2]
}

function contraste(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('tokens de couleur', () => {
  it('définit les 9 couleurs', () => {
    for (const nom of NOMS) expect(couleur(nom)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  const textes = ['encre', 'encre-2', 'sanguine', 'sauge', 'ocre']
  const fonds = ['papier', 'papier-2', 'blanc']
  for (const t of textes) {
    for (const f of fonds) {
      it(`${t} sur ${f} atteint 4,5:1 (AA)`, () => {
        const ratio = contraste(couleur(t), couleur(f))
        expect(ratio, `${t} sur ${f} : ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('blanc sur encre atteint 4,5:1 (AA)', () => {
    const ratio = contraste(couleur('blanc'), couleur('encre'))
    expect(ratio, `blanc sur encre : ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })
})

describe('variables CSS utilisées', () => {
  it('toute variable var(--x) des feuilles de style est définie dans tokens.css', () => {
    const feuilles = import.meta.glob('../**/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const definies = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const inconnues: string[] = []
    for (const [fichier, contenu] of Object.entries(feuilles)) {
      for (const m of contenu.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!definies.has(m[1])) inconnues.push(`${fichier} : ${m[1]}`)
      }
    }
    expect(inconnues).toEqual([])
  })
})
