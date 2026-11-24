import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadEnv } from '../config/env';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { SESSION_DURATION } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: loadEnv().JWT_SECRET,
        signOptions: { expiresIn: SESSION_DURATION, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, SessionGuard],
  exports: [UsersService, SessionGuard, JwtModule],
})
export class AuthModule {}
