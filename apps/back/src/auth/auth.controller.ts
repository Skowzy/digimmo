import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { loadEnv } from '../config/env';
import type { User } from '../users/user.entity';
import { SESSION_COOKIE, SESSION_DURATION_MS } from './auth.constants';
import { AuthService } from './auth.service';
import {
  type LoginDto,
  type RegisterDto,
  loginSchema,
  registerSchema,
} from './auth.schemas';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

const view = (u: User) => ({ id: u.id, email: u.email, role: u.role });

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: loadEnv().NODE_ENV === 'production',
    path: '/',
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto.email, dto.password);
    res.cookie(SESSION_COOKIE, await this.auth.sign(user), {
      ...cookieOptions(),
      maxAge: SESSION_DURATION_MS,
    });
    return view(user);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateCredentials(dto.email, dto.password);
    res.cookie(SESSION_COOKIE, await this.auth.sign(user), {
      ...cookieOptions(),
      maxAge: SESSION_DURATION_MS,
    });
    return view(user);
  }

  /** Ouverte : effacer un cookie expiré doit toujours fonctionner. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return view(user);
  }
}
