import { describe, it, expect } from 'vitest';
import { checkFurniture, checkStairs } from './furniture';
import type { Furniture, Level, LevelId, Plan, Room } from '../types';

const room = (id: string, x: number, y: number, w: number, h: number): Room =>
  ({ id, type: 'chambre', name: id, rect: { x, y, w, h } });
const meuble = (id: string, label: string, x: number, y: number, w: number, d: number, rotation: Furniture['rotation'] = 0): Furniture =>
  ({ id, catalogId: 'x', label, x, y, w, d, rotation });
const niveau = (id: LevelId, rooms: Room[], furniture: Furniture[] = []): Level =>
  ({ id, rooms, openings: [], furniture });

describe('checkFurniture', () => {
  it('lit 160×200 tourné à 90° qui déborde de 10 cm d’une chambre 300×300 → erreur', () => {
    const lit = meuble('f1', 'Lit', 110, 0, 160, 200, 90); // empreinte 200×160 : x de 110 à 310
    const v = checkFurniture(niveau('rdc', [room('c', 0, 0, 300, 300)], [lit]), null);
    expect(v.map((x) => x.code)).toEqual(['FURNITURE_OUTSIDE_ROOM']);
    expect(v[0]!.message).toBe('« Lit » doit être entièrement dans une pièce.');
    expect(v[0]!.level).toBe('rdc');
  });

  it('meuble à cheval sur deux pièces adjacentes → FURNITURE_OUTSIDE_ROOM', () => {
    const f = meuble('f1', 'Table', 250, 50, 100, 50);
    const v = checkFurniture(niveau('rdc', [room('a', 0, 0, 300, 300), room('b', 300, 0, 300, 300)], [f]), null);
    expect(v.map((x) => x.code)).toEqual(['FURNITURE_OUTSIDE_ROOM']);
  });

  it('lit et armoire qui se chevauchent → message exact', () => {
    const lit = meuble('f1', 'Lit', 0, 0, 160, 200);
    const armoire = meuble('f2', 'Armoire', 100, 0, 100, 60);
    const v = checkFurniture(niveau('rdc', [room('c', 0, 0, 400, 400)], [lit, armoire]), null);
    expect(v.map((x) => x.code)).toEqual(['FURNITURE_OVERLAP']);
    expect(v[0]!.message).toBe('Chevauchement : Lit / Armoire.');
    expect(v[0]!.refs).toEqual(['f1', 'f2']);
  });

  it('meuble sur l’escalier → FURNITURE_OVERLAP', () => {
    const f = meuble('f1', 'Commode', 0, 0, 100, 50);
    const v = checkFurniture(niveau('rdc', [room('c', 0, 0, 400, 400)], [f]), { x: 50, y: 0, w: 100, h: 250 });
    expect(v.map((x) => x.code)).toEqual(['FURNITURE_OVERLAP']);
    expect(v[0]!.message).toBe('Chevauchement : Commode / escalier.');
    expect(v[0]!.refs).toEqual(['f1', 'stairs']);
  });
});

describe('checkStairs', () => {
  const rect = { x: 0, y: 0, w: 100, h: 250 };
  it('étage sans escalier → alerte STAIRS_MISSING', () => {
    const plan: Plan = { levels: [niveau('rdc', [room('a', 0, 0, 400, 400)]), niveau('r1', [room('b', 0, 0, 400, 400)])], stairs: null };
    const v = checkStairs(plan);
    expect(v.map((x) => x.code)).toEqual(['STAIRS_MISSING']);
    expect(v[0]!.severity).toBe('warning');
    expect(v[0]!.message).toBe('Il y a un étage mais pas d\'escalier.');
  });

  it('escalier hors pièce à l’étage → STAIRS_PLACEMENT', () => {
    const plan: Plan = { levels: [niveau('rdc', [room('a', 0, 0, 400, 400)]), niveau('r1', [room('b', 200, 0, 200, 400)])], stairs: { rect } };
    const v = checkStairs(plan);
    expect(v.map((x) => x.code)).toEqual(['STAIRS_PLACEMENT']);
    expect(v[0]!.refs).toEqual(['stairs']);
  });

  it('plain-pied sans escalier → aucune violation', () => {
    const plan: Plan = { levels: [niveau('rdc', [room('a', 0, 0, 400, 400)])], stairs: null };
    expect(checkStairs(plan)).toEqual([]);
  });
});
