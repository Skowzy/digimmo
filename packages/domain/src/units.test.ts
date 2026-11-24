import { describe, expect, it } from 'vitest';
import { formatArea, formatMeters } from './units';

describe('formatMeters', () => {
  it('formate en mètres avec virgule et 2 décimales', () => {
    expect(formatMeters(420)).toBe('4,20 m');
    expect(formatMeters(0)).toBe('0,00 m');
    expect(formatMeters(2005)).toBe('20,05 m');
  });
});

describe('formatArea', () => {
  it('formate des cm² en m²', () => {
    expect(formatArea(420 * 360)).toBe('15,12 m²');
    expect(formatArea(90_000)).toBe('9,00 m²');
  });
});
