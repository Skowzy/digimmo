import { SetMetadata } from '@nestjs/common';
import type { User } from '../users/user.entity';

export const ROLES_KEY = 'roles';

/** Restreint une route (ou un contrôleur) aux rôles indiqués. */
export const Roles = (...roles: User['role'][]) =>
  SetMetadata(ROLES_KEY, roles);
