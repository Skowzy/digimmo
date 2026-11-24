import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../users/user.entity';
import type { AuthenticatedRequest } from './session.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
