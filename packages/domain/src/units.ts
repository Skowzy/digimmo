const fr = (value: number): string => value.toFixed(2).replace('.', ',');

/** Formate une longueur en centimètres vers des mètres, ex. 420 -> "4,20 m". */
export function formatMeters(cm: number): string {
  return `${fr(cm / 100)} m`;
}

/** Formate une surface en cm² vers des m², ex. 90000 -> "9,00 m²". */
export function formatArea(cm2: number): string {
  return `${fr(cm2 / 10_000)} m²`;
}
