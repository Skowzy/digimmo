import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import type { User } from '../users/user.entity';
import { SESSION_COOKIE } from './auth.constants';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = Request & { user: User };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = (
      req.cookies as Record<string, unknown> | undefined
    )?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token === '') throw this.denied();

    let sub: unknown;
    let iat: unknown;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        iat?: unknown;
      }>(token, { algorithms: ['HS256'] });
      sub = payload.sub;
      iat = payload.iat;
    } catch {
      throw this.denied();
    }
    if (typeof sub !== 'string') throw this.denied();

    // Seul `sub` est cru : l'utilisateur (et son rôle) est rechargé en base.
    let user: User | null;
    try {
      user = await this.users.findById(sub);
    } catch {
      throw this.denied();
    }
    if (!user) throw this.denied();
    // Session émise avant le dernier changement de mot de passe : refusée.
    // (`iat` est en secondes : même seconde que le changement = acceptée.)
    if (user.passwordChangedAt) {
      const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (typeof iat !== 'number' || iat < changedAt) throw this.denied();
    }
    req.user = user;
    return true;
  }

  private denied() {
    return new UnauthorizedException({ message: 'Non authentifié.' });
  }
}
