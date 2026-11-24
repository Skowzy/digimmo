import { describe, expect, it } from 'vitest';
import { rectangularSite } from './defaults';

describe('rectangularSite', () => {
  it('rectangularSite construit un rectangle horaire et choisit l’arête de voie', () => {
    const s = rectangularSite(2000, 3000, 'south');
    expect(s.boundary).toEqual([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 3000 }, { x: 0, y: 3000 }]);
    expect(s.streetEdge).toBe(2);
  });
});
