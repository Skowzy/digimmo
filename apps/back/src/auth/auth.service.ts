import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { QueryFailedError } from 'typeorm';
import type { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  /** Hash factice : sert à dépenser le même temps quand l'e-mail est inconnu. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<User> {
    const passwordHash = await argon2.hash(password);
    try {
      // La contrainte d'unicité en base fait foi (pas de pré-vérification racée).
      return await this.users.create(email, passwordHash);
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string } | undefined)?.code ===
          UNIQUE_VIOLATION
      ) {
        throw new ConflictException({
          message: 'Un compte existe déjà avec cette adresse.',
        });
      }
      throw e;
    }
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!user || !ok) {
      throw new UnauthorizedException({ message: 'Identifiants invalides.' });
    }
    return user;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return argon2.verify(user.passwordHash, password).catch(() => false);
  }

  sign(user: User): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, role: user.role });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash('digimmo-dummy-password-never-matches');
    return this.dummyHash;
  }
}
