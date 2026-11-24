import { describe, it, expect } from 'vitest';
import {
  area, intersection, overlaps, containsRect, furnitureFootprint, rectInPolygon,
  distanceRectToSegment, coveredByUnion, pointInPolygon, distancePointToRect, distancePointToSegment, corners,
} from './geometry';

const A = { x: 0, y: 0, w: 400, h: 300 };
const sq = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];

describe('geometry', () => {
  it('area', () => expect(area(A)).toBe(120_000));
  it('bord à bord ne chevauche pas', () => expect(overlaps(A, { x: 400, y: 0, w: 400, h: 300 })).toBe(false));
  it('1 cm de recouvrement chevauche', () => expect(overlaps(A, { x: 399, y: 0, w: 400, h: 300 })).toBe(true));
  it('intersection', () => expect(intersection(A, { x: 300, y: 200, w: 400, h: 400 })).toEqual({ x: 300, y: 200, w: 100, h: 100 }));
  it('intersection null au contact', () => expect(intersection(A, { x: 400, y: 0, w: 10, h: 10 })).toBeNull());
  it('containsRect bords inclus', () => expect(containsRect(A, A)).toBe(true));
  it('containsRect faux si dépasse', () => expect(containsRect(A, { x: 0, y: 0, w: 401, h: 10 })).toBe(false));
  it('furnitureFootprint tourne de 90°', () =>
    expect(furnitureFootprint({ id: 'f', catalogId: 'lit', label: 'Lit', x: 10, y: 20, w: 160, d: 200, rotation: 90 }))
      .toEqual({ x: 10, y: 20, w: 200, h: 160 }));
  it('furnitureFootprint 0° garde w et d', () =>
    expect(furnitureFootprint({ id: 'f', catalogId: 'lit', label: 'Lit', x: 10, y: 20, w: 160, d: 200, rotation: 0 }))
      .toEqual({ x: 10, y: 20, w: 160, h: 200 }));
  it('corners', () => expect(corners({ x: 1, y: 2, w: 3, h: 4 })).toHaveLength(4));
  it('pointInPolygon : bord inclus, extérieur exclu, polygone en L', () => {
    expect(pointInPolygon({ x: 0, y: 500 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 500, y: 500 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 1001, y: 500 }, sq)).toBe(false);
    const L = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }];
    expect(pointInPolygon({ x: 150, y: 150 }, L)).toBe(false);
    expect(pointInPolygon({ x: 50, y: 150 }, L)).toBe(true);
  });
  it('rectInPolygon', () => {
    expect(rectInPolygon({ x: 0, y: 0, w: 1000, h: 1000 }, sq)).toBe(true);
    expect(rectInPolygon({ x: 900, y: 0, w: 101, h: 10 }, sq)).toBe(false);
  });
  it('distancePointToSegment', () => expect(distancePointToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3));
  it('distancePointToRect', () => {
    expect(distancePointToRect({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(0);
    expect(distancePointToRect({ x: 13, y: 14 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(5);
  });
  it('distanceRectToSegment', () =>
    expect(distanceRectToSegment({ x: 100, y: 300, w: 50, h: 50 }, { x: 0, y: 0 }, { x: 1000, y: 0 })).toBe(300));
  it('distanceRectToSegment : segment traversant le rectangle = 0', () => {
    expect(distanceRectToSegment({ x: 100, y: 100, w: 50, h: 50 }, { x: 0, y: 125 }, { x: 1000, y: 125 })).toBe(0);
    expect(distanceRectToSegment({ x: 100, y: 100, w: 50, h: 50 }, { x: 110, y: 110 }, { x: 120, y: 120 })).toBe(0);
  });
  it('coveredByUnion : couvert par deux rectangles adjacents', () => {
    expect(coveredByUnion({ x: 100, y: 0, w: 600, h: 100 }, [{ x: 0, y: 0, w: 400, h: 300 }, { x: 400, y: 0, w: 400, h: 300 }])).toBe(true);
    expect(coveredByUnion({ x: 100, y: 0, w: 800, h: 100 }, [{ x: 0, y: 0, w: 400, h: 300 }, { x: 400, y: 0, w: 400, h: 300 }])).toBe(false);
  });
});
