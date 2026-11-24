import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import { cookieOptions } from '../auth/session-cookie';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { User } from '../users/user.entity';
import { AccountService } from './account.service';

const deleteSchema = z.strictObject({ password: z.string().min(1).max(128) });
type DeleteDto = z.infer<typeof deleteSchema>;

@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="digimmo-export.json"')
  @Header('Cache-Control', 'no-store')
  export(@CurrentUser() user: User) {
    return this.account.export(user);
  }

  /** Vérifie un mot de passe : limité comme le login. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Delete()
  @HttpCode(204)
  async remove(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(deleteSchema)) dto: DeleteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.delete(user, dto.password);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }
}
