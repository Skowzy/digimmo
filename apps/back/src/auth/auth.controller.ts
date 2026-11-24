import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { User } from '../users/user.entity';
import { SESSION_COOKIE, SESSION_DURATION_MS } from './auth.constants';
import { AuthService } from './auth.service';
import { cookieOptions } from './session-cookie';
import { PasswordResetService } from './password-reset.service';
import {
  type ForgotDto,
  type LoginDto,
  type RegisterDto,
  type ResetDto,
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from './auth.schemas';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';

const view = (u: User) => ({ id: u.id, email: u.email, role: u.role });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @UseGuards(ThrottlerGuard)
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

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(202)
  async forgot(@Body(new ZodValidationPipe(forgotSchema)) dto: ForgotDto) {
    await this.passwordReset.request(dto.email);
    return {
      message:
        "Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.",
    };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(resetSchema)) dto: ResetDto,
  ): Promise<void> {
    if (!(await this.passwordReset.reset(dto.token, dto.password))) {
      throw new BadRequestException({ message: 'Lien invalide ou expiré.' });
    }
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
