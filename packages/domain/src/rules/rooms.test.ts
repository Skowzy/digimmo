import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_PARAMS } from '../defaults';
import type { Level } from '../types';
import { checkRoomAreas, checkRoomOverlaps, checkUpperSupported } from './rooms';

describe('règles des pièces', () => {
  it('deux pièces 400×300 bord à bord → valide ; 1 cm de recouvrement → erreur', () => {
    const lvl = (dx: number): Level => ({ id: 'rdc', openings: [], furniture: [], rooms: [
      { id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 400, h: 300 } },
      { id: 'b', type: 'cuisine', name: 'Cuisine', rect: { x: 400 - dx, y: 0, w: 400, h: 300 } }] });
    expect(checkRoomOverlaps(lvl(0))).toEqual([]);
    expect(checkRoomOverlaps(lvl(1))[0]).toMatchObject({ code: 'ROOM_OVERLAP', message: '« Séjour » et « Cuisine » se chevauchent.', refs: ['a', 'b'], level: 'rdc' });
  });
  it('chambre de 8,97 m² refusée, 9 m² acceptée', () => {
    const lvl = (w: number): Level => ({ id: 'rdc', openings: [], furniture: [],
      rooms: [{ id: 'c', type: 'chambre', name: 'Ch. 1', rect: { x: 0, y: 0, w, h: 300 } }] });
    expect(checkRoomAreas(lvl(300), DEFAULT_RULE_PARAMS)).toEqual([]);
    expect(checkRoomAreas(lvl(299), DEFAULT_RULE_PARAMS)[0]).toMatchObject({ code: 'ROOM_MIN_AREA', message: '« Ch. 1 » fait 8,97 m² : minimum 9,00 m² pour ce type de pièce.' });
  });
  it('pièce d’étage qui déborde du RDC', () => {
    const rdc: Level = { id: 'rdc', openings: [], furniture: [], rooms: [{ id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 800, h: 600 } }] };
    const r1 = (w: number): Level => ({ id: 'r1', openings: [], furniture: [], rooms: [{ id: 'u', type: 'chambre', name: 'Ch. 2', rect: { x: 0, y: 0, w, h: 300 } }] });
    expect(checkUpperSupported(rdc, r1(800))).toEqual([]);
    expect(checkUpperSupported(rdc, r1(900))[0]).toMatchObject({ code: 'UPPER_NOT_SUPPORTED', level: 'r1', message: '« Ch. 2 » (étage) n\'est pas au-dessus du rez-de-chaussée.' });
  });
});
