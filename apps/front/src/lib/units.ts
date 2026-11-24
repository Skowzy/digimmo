import type { Site } from '@digimmo/domain'

type Rue = 'north' | 'south' | 'east' | 'west'
const RUE_PAR_ARETE: Rue[] = ['north', 'east', 'south', 'west']

/** Découpe « 20,5 » / « 20.5 » en parties entière et décimale ; null si le format est invalide. */
function decouper(input: string, maxDecimals: number): { entier: string; decimales: string } | null {
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(input.trim())
  if (!m) return null
  const decimales = m[2] ?? ''
  if (decimales.length > maxDecimals) return null
  return { entier: m[1], decimales }
}

function enCentimetres(input: string): number | null {
  const parts = decouper(input, 2)
  if (!parts) return null
  const cm = Number(parts.entier) * 100 + Number(parts.decimales.padEnd(2, '0'))
  return Number.isSafeInteger(cm) ? cm : null
}

/** Mètres saisis → centimètres entiers (arithmétique sur chaînes) ; null si invalide ou ≤ 0. */
export function parseMeters(input: string): number | null {
  const cm = enCentimetres(input)
  return cm === null || cm <= 0 ? null : cm
}

/** Comme `parseMeters`, mais 0 est accepté (reculs). */
export function parseMetersOrZero(input: string): number | null {
  return enCentimetres(input)
}

/** Nombre décimal positif ou nul (pourcentage, m²) ; virgule ou point. */
export function parseDecimal(input: string, maxDecimals: number): number | null {
  const parts = decouper(input, maxDecimals)
  if (!parts) return null
  const n = Number(parts.decimales ? `${parts.entier}.${parts.decimales}` : parts.entier)
  return Number.isFinite(n) ? n : null
}

/** 500 → « 5,00 » */
export function metersToInput(cm: number): string {
  const entier = Math.trunc(cm / 100)
  return `${entier},${String(cm % 100).padStart(2, '0')}`
}

/** 37.5 → « 37,5 » */
export function decimalToInput(n: number): string {
  return String(n).replace('.', ',')
}

/** Terrain rectangulaire (4 sommets alignés sur les axes) → largeur, profondeur, côté de voie ; sinon null. */
export function siteToTerrain(site: Site): { widthCm: number; depthCm: number; street: Rue } | null {
  const b = site.boundary
  if (b.length !== 4) return null
  const xs = b.map((p) => p.x)
  const ys = b.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const surLesCoins = b.every((p) => (p.x === minX || p.x === maxX) && (p.y === minY || p.y === maxY))
  const distincts = new Set(b.map((p) => `${p.x},${p.y}`)).size === 4
  const street = RUE_PAR_ARETE[site.streetEdge]
  if (!surLesCoins || !distincts || maxX === minX || maxY === minY || !street) return null
  return { widthCm: maxX - minX, depthCm: maxY - minY, street }
}
