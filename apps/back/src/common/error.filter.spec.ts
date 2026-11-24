import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describeError } from './error.filter';

describe('describeError', () => {
  it('garde le message et les issues français de nos exceptions', () => {
    const e = new BadRequestException({
      message: 'Données invalides.',
      issues: ['a'],
    });
    expect(describeError(e)).toEqual({
      status: 400,
      body: { message: 'Données invalides.', issues: ['a'] },
    });
  });

  it('route introuvable de Nest : 404 français', () => {
    const e = new NotFoundException('Cannot GET /api/nope');
    expect(describeError(e)).toEqual({
      status: 404,
      body: { message: 'Ressource introuvable.' },
    });
  });

  it('erreur inattendue : 500 générique, sans détail', () => {
    const r = describeError(new Error('secret: connexion pg://u:p@host'));
    expect(r).toEqual({
      status: 500,
      body: { message: 'Erreur interne du serveur.' },
    });
  });

  it('erreurs body-parser', () => {
    const mk = (type: string, status: number) =>
      Object.assign(new Error('x'), { type, status, expose: true });
    expect(describeError(mk('entity.too.large', 413)).status).toBe(413);
    expect(describeError(mk('entity.parse.failed', 400)).body.message).toBe(
      'JSON invalide.',
    );
    expect(describeError(mk('charset.unsupported', 415))).toEqual({
      status: 415,
      body: { message: 'Type de contenu non pris en charge.' },
    });
    expect(describeError(mk('encoding.unsupported', 415)).status).toBe(415);
    expect(describeError(mk('other', 400))).toEqual({
      status: 400,
      body: { message: 'Requête invalide.' },
    });
  });
});
