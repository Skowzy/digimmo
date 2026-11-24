import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '../users/user.entity';
import { ROLES_KEY } from './roles.decorator';
import type { AuthenticatedRequest } from './session.guard';

/** S'exécute après SessionGuard : `req.user` est le rôle rechargé en base. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<User['role'][] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException({
        message: 'Accès réservé aux administrateurs.',
      });
    }
    return true;
  }
}
