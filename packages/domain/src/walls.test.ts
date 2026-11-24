import { describe, it, expect } from 'vitest';
import { computeWallSegments, findSegmentFor } from './walls';
import type { Room, Opening } from './types';

const a = { id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 600, h: 400 } } as Room;
const b = { id: 'b', type: 'chambre', name: 'Ch. 1', rect: { x: 0, y: 400, w: 300, h: 300 } } as Room;
const c = { id: 'c', type: 'cuisine', name: 'Cuisine', rect: { x: 300, y: 400, w: 300, h: 300 } } as Room;

describe('computeWallSegments', () => {
  it('pièce seule : 4 segments extérieurs', () => {
    const s = computeWallSegments([a]);
    expect(s).toHaveLength(4);
    expect(s.every(x => x.exterior)).toBe(true);
  });
  it('côté de 6 m dont 3 m partagés : un intérieur de 3 m et un extérieur de 3 m', () => {
    const bottom = computeWallSegments([a, b]).filter(s => s.orientation === 'h' && s.fixed === 400);
    expect(bottom).toEqual([
      { orientation: 'h', fixed: 400, start: 0, end: 300, roomIds: ['a', 'b'], exterior: false },
      { orientation: 'h', fixed: 400, start: 300, end: 600, roomIds: ['a'], exterior: true },
    ]);
  });
  it('côté partagé avec deux voisines différentes', () => {
    const bottom = computeWallSegments([a, b, c]).filter(s => s.orientation === 'h' && s.fixed === 400);
    expect(bottom).toEqual([
      { orientation: 'h', fixed: 400, start: 0, end: 300, roomIds: ['a', 'b'], exterior: false },
      { orientation: 'h', fixed: 400, start: 300, end: 600, roomIds: ['a', 'c'], exterior: false },
    ]);
  });
  it('pièces superposées : ne plante pas', () => {
    expect(() => computeWallSegments([a, { ...a, id: 'z', rect: { x: 100, y: 100, w: 600, h: 400 } }])).not.toThrow();
  });
});

describe('fusion des sous-intervalles', () => {
  it('une coupure artificielle (côté de largeur nulle) ne scinde pas le segment', () => {
    const z = { id: 'z', type: 'autre', name: 'Z', rect: { x: 300, y: 0, w: 0, h: 0 } } as Room;
    const top = computeWallSegments([a, z]).filter(s => s.orientation === 'h' && s.fixed === 0);
    expect(top).toEqual([{ orientation: 'h', fixed: 0, start: 0, end: 600, roomIds: ['a'], exterior: true }]);
    const door = { id: 'd', kind: 'door', orientation: 'h', fixed: 0, start: 250, width: 100 } as Opening;
    expect(findSegmentFor(door, top)).not.toBeNull();
  });
});

describe('findSegmentFor', () => {
  it('trouve le segment qui contient l’ouverture', () => {
    const segs = computeWallSegments([a, b]);
    const door = { id: 'd', kind: 'door', orientation: 'h', fixed: 400, start: 100, width: 90 } as Opening;
    expect(findSegmentFor(door, segs)?.exterior).toBe(false);
    expect(findSegmentFor({ ...door, start: 250 }, segs)).toBeNull();
  });
});
