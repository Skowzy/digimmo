import * as jestDomMatchers from '@testing-library/jest-dom/matchers'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { server } from './server'

// Matchers enregistrés explicitement : le sous-chemin `/vitest` de jest-dom
// résoudrait le vitest hissé à la racine (celui du domaine), pas celui du front.
expect.extend(jestDomMatchers)
expect.extend(axeMatchers)

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends AxeMatchers, TestingLibraryMatchers<unknown, T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
interface AxeMatchers {
  toHaveNoViolations(): void
}

// jsdom n'implémente pas <dialog>.showModal / close.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '')
  // Comme les navigateurs : le focus passe au premier élément focalisable (sinon au dialogue).
  const cible = this.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (cible) cible.focus()
  else {
    this.tabIndex = -1
    this.focus()
  }
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}

// axe appelle canvas.getContext ; jsdom ne l'implémente pas (avertissement).
HTMLCanvasElement.prototype.getContext = () => null

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())

// jsdom n'implémente pas la géométrie SVG : matrice identité, donc les coordonnées client
// valent directement des cm du plan dans les tests d'interaction.
type Matrice = { a: number; b: number; c: number; d: number; e: number; f: number; inverse(): Matrice }
function nouveauPoint(x = 0, y = 0): DOMPoint {
  return {
    x,
    y,
    matrixTransform(m: Matrice) {
      return nouveauPoint(m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f)
    },
  } as unknown as DOMPoint
}
SVGSVGElement.prototype.createSVGPoint = () => nouveauPoint()
SVGSVGElement.prototype.getScreenCTM = function getScreenCTM() {
  const m: Matrice = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse() { return this } }
  return m as unknown as DOMMatrix
}
