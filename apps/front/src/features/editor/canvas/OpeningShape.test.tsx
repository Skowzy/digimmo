import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Opening } from '@digimmo/domain'
import { OpeningShape } from './OpeningShape'

const porte: Opening = { id: 'o1', kind: 'door', orientation: 'h', fixed: 900, start: 560, width: 90, swing: { hinge: 'start', side: 'pos' } }
const fenetre: Opening = { id: 'o2', kind: 'window', orientation: 'h', fixed: 500, start: 400, width: 120 }
const dansSvg = (o: Opening, props = {}) => render(<svg><OpeningShape opening={o} {...props} /></svg>).container

describe('OpeningShape', () => {
  it('une porte contient un path d\'arc de rayon = largeur depuis la charnière', () => {
    const c = dansSvg(porte)
    const arc = c.querySelector('path[data-arc]')
    expect(arc).not.toBeNull()
    expect(arc!.getAttribute('d')).toMatch(/^M 560 990 A 90 90 0 0 [01] 650 900$/)
  })
  it('une fenêtre n\'a pas d\'arc mais deux traits fins', () => {
    const c = dansSvg(fenetre)
    expect(c.querySelector('path[data-arc]')).toBeNull()
    expect(c.querySelectorAll('line[data-vitre]')).toHaveLength(2)
  })
  it('porte la classe d\'erreur et le contour de sélection', () => {
    const c = dansSvg(porte, { enErreur: true, selectionnee: true })
    expect(c.querySelector('[data-opening="o1"]')!.getAttribute('class')).toMatch(/enErreur/)
    expect(c.querySelector('[data-contour]')).not.toBeNull()
  })
})
