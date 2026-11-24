const UNITES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

const formateur = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

/** « modifié à l'instant » / « modifié il y a 2 j »… avec la plus grande unité entière. */
export function modifieIlYa(iso: string, maintenant = Date.now()): string {
  const delta = maintenant - new Date(iso).getTime()
  for (const [unite, ms] of UNITES) {
    if (delta >= ms) return `modifié ${formateur.format(-Math.floor(delta / ms), unite)}`
  }
  return "modifié à l'instant"
}
