import { describe, expect, it } from 'vitest';
import type { Furniture, Level, Opening } from '../types';
import { checkOpenings, doorHinge, doorSwingRect } from './openings';

const rooms: Level['rooms'] = [
  { id: 'a', type: 'sejour', name: 'Séjour', rect: { x: 0, y: 0, w: 600, h: 400 } },
  { id: 'b', type: 'chambre', name: 'Ch. 1', rect: { x: 0, y: 400, w: 300, h: 300 } },
];
const lvl = (openings: Opening[], furniture: Furniture[] = [], r = rooms): Level => ({ id: 'rdc', rooms: r, openings, furniture });
const op = (o: Partial<Opening> & Pick<Opening, 'id' | 'kind'>): Opening => ({ orientation: 'h', fixed: 400, start: 100, width: 90, ...o });
const door = (o: Partial<Opening> = {}): Opening => op({ id: 'd', kind: 'door', swing: { hinge: 'start', side: 'pos' }, ...o });
const win = (o: Partial<Opening> = {}): Opening => op({ id: 'w', kind: 'window', ...o });
const meuble = (x: number, y: number, w: number, d: number): Furniture => ({ id: 'f', catalogId: 'armoire', label: 'Armoire', x, y, w, d, rotation: 0 });
const porte80 = door({ width: 80 });
const codes = (l: Level) => checkOpenings(l).map(v => v.code);

describe('géométrie de porte', () => {
  it('charnière et carré de débattement (mur h et v)', () => {
    expect(doorHinge(door())).toEqual({ x: 100, y: 400 });
    expect(doorHinge(door({ swing: { hinge: 'end', side: 'pos' } }))).toEqual({ x: 190, y: 400 });
    expect(doorSwingRect(door())).toEqual({ x: 100, y: 400, w: 90, h: 90 });
    expect(doorSwingRect(door({ swing: { hinge: 'start', side: 'neg' } }))).toEqual({ x: 100, y: 310, w: 90, h: 90 });
    const v = door({ orientation: 'v', fixed: 600, swing: { hinge: 'end', side: 'neg' } });
    expect(doorHinge(v)).toEqual({ x: 600, y: 190 });
    expect(doorSwingRect(v)).toEqual({ x: 510, y: 100, w: 90, h: 90 });
  });
});

describe('checkOpenings', () => {
  it('porte sur mur intérieur → valide', () => {
    expect(codes(lvl([door()]))).toEqual([]);
  });
  it('fenêtre sur mur intérieur → erreur', () => {
    expect(checkOpenings(lvl([win()]))).toEqual([{ code: 'WINDOW_ON_INTERIOR_WALL', severity: 'error', message: 'Une fenêtre doit être sur un mur extérieur.', refs: ['w'], level: 'rdc' }]);
  });
  it('fenêtre sur mur extérieur → valide', () => {
    expect(codes(lvl([win({ fixed: 0, width: 120 })]))).toEqual([]);
  });
  it('ouverture orpheline après déplacement de la pièce → OPENING_NOT_ON_WALL sans exception', () => {
    const v = checkOpenings(lvl([win({ fixed: 450 })]));
    expect(v.map(x => x.code)).toEqual(['OPENING_NOT_ON_WALL']);
    expect(v[0]).toMatchObject({ message: 'Une ouverture n\'est sur aucun mur.', refs: ['w'], level: 'rdc', severity: 'error' });
  });
  it('deux ouvertures qui se recouvrent', () => {
    const v = checkOpenings(lvl([win({ id: 'w1', fixed: 0, width: 120 }), win({ id: 'w2', fixed: 0, start: 200, width: 120 })]));
    expect(v.map(x => x.code)).toEqual(['OPENING_OVERLAP']);
    expect(v[0]).toMatchObject({ message: 'Deux ouvertures se chevauchent sur le même mur.', refs: ['w1', 'w2'] });
  });
  it('ouvertures bout à bout → pas de chevauchement', () => {
    expect(codes(lvl([win({ id: 'w1', fixed: 0, width: 100 }), win({ id: 'w2', fixed: 0, start: 200, width: 100 })]))).toEqual([]);
  });
  it('armoire dans l’arc d’une porte de 80 cm → DOOR_BLOCKED (jeu d’essai)', () => {
    const v = checkOpenings(lvl([porte80], [meuble(110, 410, 60, 60)]));
    expect(v.map(x => x.code)).toEqual(['DOOR_BLOCKED']);
    expect(v[0]).toMatchObject({ message: '« Armoire » gêne l\'ouverture d\'une porte.', refs: ['d', 'f'], level: 'rdc' });
  });
  it('meuble dans le coin du carré hors de l’arc → valide', () => {
    expect(codes(lvl([porte80], [meuble(175, 475, 5, 5)]))).toEqual([]);
    expect(codes(lvl([door()], [meuble(185, 485, 5, 5)]))).toEqual([]);
  });
  it('distance charnière → intersection exactement égale à la largeur → pas bloquée', () => {
    // charnière (100,400), point le plus proche (148,464) : 3-4-5 → distance 80 = largeur
    expect(codes(lvl([porte80], [meuble(148, 464, 10, 10)]))).toEqual([]);
    expect(codes(lvl([porte80], [meuble(147, 464, 10, 10)]))).toEqual(['DOOR_BLOCKED']);
  });
  it('porte sur mur v, côté neg, bloquée par un meuble', () => {
    const r = [...rooms.slice(0, 1), { id: 'c', type: 'chambre' as const, name: 'Ch. 2', rect: { x: 600, y: 0, w: 300, h: 400 } }];
    const d = door({ orientation: 'v', fixed: 600, swing: { hinge: 'start', side: 'neg' } });
    expect(codes(lvl([d], [meuble(520, 110, 40, 40)], r))).toEqual(['DOOR_BLOCKED']);
    expect(codes(lvl([d], [meuble(610, 110, 40, 40)], r))).toEqual([]);
  });
  it('porte sans swing ignorée pour DOOR_BLOCKED', () => {
    expect(codes(lvl([door({ swing: undefined })], [meuble(110, 410, 50, 40)]))).toEqual([]);
  });
});
