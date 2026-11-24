import { describe, expect, it } from 'vitest';
import { DEFAULT_RULE_PARAMS, rectangularSite } from '../defaults';
import type { Room } from '../types';
import { checkSite } from './site';

const site = rectangularSite(2000, 3000, 'north');
const room = (x: number, y: number, w = 1000, h = 1000): Room => ({ id: 'r', type: 'sejour', name: 'Séjour', rect: { x, y, w, h } });

describe('checkSite', () => {
  it('maison à 3 m de la voie pour 5 m exigés → refus (jeu d’essai du dossier)', () => {
    const v = checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 300)]);
    expect(v).toContainEqual(expect.objectContaining({ code: 'SETBACK_STREET', message: '« Séjour » est à 3,00 m de la voie (minimum 5,00 m).' }));
  });
  it('distance exactement égale au recul → valide', () => {
    expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 500)]).filter(v => v.code === 'SETBACK_STREET')).toEqual([]);
  });
  it('trop près d’une limite séparative', () =>
    expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(100, 600)]).map(v => v.code)).toContain('SETBACK_SIDES'));
  it('pièce hors terrain', () =>
    expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(1500, 600)]).map(v => v.code)).toContain('HOUSE_OUTSIDE_SITE'));
  it('emprise : 40 % max', () => {
    expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 500, 1000, 2500)])).toContainEqual(
      expect.objectContaining({ code: 'FOOTPRINT_MAX', message: 'Emprise au sol de 41,7 % : le maximum est 40 %.' }));
    expect(checkSite(site, DEFAULT_RULE_PARAMS, [room(500, 500, 1000, 2200)]).map(v => v.code)).toContain('FOOTPRINT_NEAR_MAX');
  });
  it('aucune pièce → aucune violation', () => expect(checkSite(site, DEFAULT_RULE_PARAMS, [])).toEqual([]));
});
