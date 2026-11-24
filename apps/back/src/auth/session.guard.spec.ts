import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionGuard } from './session.guard';

const ctx = (token: string) =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ cookies: { digimmo_session: token } }),
    }),
  }) as unknown as ExecutionContext;

function guard(sub: unknown, findById: jest.Mock) {
  const jwt = { verifyAsync: () => Promise.resolve({ sub, iat: 1 }) };
  return new SessionGuard(new Reflector(), jwt as never, { findById } as never);
}

describe('SessionGuard', () => {
  it('sub qui n’est pas un UUID : 401 sans interroger la base', async () => {
    const findById = jest.fn();
    await expect(
      guard('nope', findById).canActivate(ctx('t')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('panne de base : l’erreur remonte (pas un faux 401)', async () => {
    const boom = new Error('connexion perdue');
    const findById = jest.fn().mockRejectedValue(boom);
    await expect(
      guard('0b7d2c4e-1a2b-4c3d-8e9f-0123456789ab', findById).canActivate(
        ctx('t'),
      ),
    ).rejects.toBe(boom);
  });
});
