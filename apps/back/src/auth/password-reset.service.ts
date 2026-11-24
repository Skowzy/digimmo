import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { IsNull, Repository } from 'typeorm';
import { loadEnv } from '../config/env';
import { MAIL_SENDER, type MailSender } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PasswordReset } from './password-reset.entity';

const TOKEN_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Jamais `e.message` : une réponse SMTP peut contenir l'adresse du destinataire. */
function describeMailError(e: unknown): string {
  const err = e as { code?: unknown; name?: unknown } | null;
  if (typeof err?.code === 'string') return err.code;
  return typeof err?.name === 'string' ? err.name : 'erreur inconnue';
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(PasswordReset)
    private readonly repo: Repository<PasswordReset>,
    private readonly users: UsersService,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  /** Ne révèle jamais si l'adresse existe : même retour, aucune erreur propagée. */
  async request(email: string, now = new Date()): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    await this.repo.manager.transaction(async (m) => {
      // Une nouvelle demande invalide les jetons précédents non utilisés.
      await m.update(
        PasswordReset,
        { user: { id: user.id }, usedAt: IsNull() },
        { usedAt: now },
      );
      await m.insert(PasswordReset, {
        user: { id: user.id },
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
      });
    });

    // Sans attendre le SMTP : le temps de réponse ne distingue pas les adresses.
    void this.mail
      .send({
        to: user.email,
        subject: 'Digimmo : réinitialisation de votre mot de passe',
        text: [
          'Bonjour,',
          '',
          'Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, usage unique) :',
          `${loadEnv().FRONT_ORIGIN}/mot-de-passe/reinitialiser?token=${token}`,
          '',
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
        ].join('\n'),
      })
      .catch((e: unknown) =>
        // Ni jeton ni adresse dans les journaux.
        this.logger.error(
          `Échec d'envoi de l'e-mail de réinitialisation : ${describeMailError(e)}`,
        ),
      );
  }

  async reset(
    token: string,
    newPassword: string,
    now = new Date(),
  ): Promise<boolean> {
    const row = await this.repo.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      return false;
    }
    const passwordHash = await argon2.hash(newPassword);
    return this.repo.manager.transaction(async (m) => {
      // Garde atomique : un seul appel concurrent passe de « non utilisé » à « utilisé ».
      const res = await m.update(
        PasswordReset,
        { id: row.id, usedAt: IsNull() },
        { usedAt: now },
      );
      if (res.affected !== 1) return false;
      // Tout autre jeton encore valide de cet utilisateur est révoqué.
      await m.update(
        PasswordReset,
        { user: { id: row.user.id }, usedAt: IsNull() },
        { usedAt: now },
      );
      await m.update(
        User,
        { id: row.user.id },
        { passwordHash, passwordChangedAt: now },
      );
      return true;
    });
  }
}
