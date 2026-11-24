import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PasswordResetService } from './password-reset.service';
import type { SentMail } from '../mail/mail.service';
import { User } from '../users/user.entity';

type Row = {
  id: string;
  user: { id: string };
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/** Dépôt simulé en mémoire : juste ce dont le service a besoin. */
function setup() {
  const user = {
    id: 'u1',
    email: 'alice@example.com',
    passwordHash: 'ancien',
    passwordChangedAt: null as Date | null,
  } as unknown as User;
  const rows: Row[] = [];
  const mails: SentMail[] = [];
  const manager = {
    insert: (_e: unknown, row: Omit<Row, 'id' | 'usedAt'>) => {
      rows.push({ ...row, id: `r${rows.length}`, usedAt: null });
      return Promise.resolve();
    },
    update: (
      entity: unknown,
      criteria: string | { id?: string; user?: { id: string } },
      partial: Record<string, unknown>,
    ) => {
      if (entity === User) {
        Object.assign(user, partial);
        return Promise.resolve({ affected: 1 });
      }
      const hits = rows.filter((r) =>
        typeof criteria === 'string'
          ? r.id === criteria
          : (criteria.id === undefined || r.id === criteria.id) &&
            (criteria.user === undefined || r.user.id === criteria.user.id) &&
            r.usedAt === null,
      );
      hits.forEach((r) => Object.assign(r, partial));
      return Promise.resolve({ affected: hits.length });
    },
  };
  const repo = {
    manager: {
      transaction: (cb: (m: typeof manager) => unknown) => cb(manager),
    },
    findOne: ({ where }: { where: { tokenHash: string } }) =>
      Promise.resolve(
        rows.find((r) => r.tokenHash === where.tokenHash)
          ? { ...rows.find((r) => r.tokenHash === where.tokenHash)!, user }
          : null,
      ),
  };
  const users = {
    findByEmail: (e: string) => Promise.resolve(e === user.email ? user : null),
  };
  const mail = {
    send: (m: SentMail) => {
      mails.push(m);
      return Promise.resolve();
    },
  };
  const service = new PasswordResetService(repo as never, users as never, mail);
  const tokenOf = () =>
    new URL(
      mails[mails.length - 1].text.match(/https?:\/\/\S+/)![0],
    ).searchParams.get('token')!;
  return { service, rows, mails, user, tokenOf };
}

beforeAll(() => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgres://u:p@localhost:5432/x',
    MONGO_URL: 'mongodb://localhost:27017/x',
    JWT_SECRET: 'test-secret-test-secret-test-secret-0123456789',
    FRONT_ORIGIN: 'http://localhost:5173',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    MAIL_FROM: 'Digimmo <no-reply@digimmo.test>',
  });
});

describe('PasswordResetService', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const plus = (min: number) => new Date(now.getTime() + min * 60_000);
  const PWD = 'nouveau-mot-de-passe';

  it('accepte le jeton à +59 min', async () => {
    const { service, tokenOf, user } = setup();
    await service.request('alice@example.com', now);
    await expect(service.reset(tokenOf(), PWD, plus(59))).resolves.toBe(true);
    expect(await argon2.verify(user.passwordHash, PWD)).toBe(true);
    expect(user.passwordChangedAt).toEqual(plus(59));
  });

  it('refuse le jeton à +61 min', async () => {
    const { service, tokenOf, user } = setup();
    await service.request('alice@example.com', now);
    await expect(service.reset(tokenOf(), PWD, plus(61))).resolves.toBe(false);
    expect(user.passwordHash).toBe('ancien');
  });

  it('refuse une seconde utilisation du même jeton', async () => {
    const { service, tokenOf } = setup();
    await service.request('alice@example.com', now);
    const token = tokenOf();
    await expect(service.reset(token, PWD, plus(1))).resolves.toBe(true);
    await expect(service.reset(token, PWD, plus(2))).resolves.toBe(false);
  });

  it('refuse un jeton inconnu', async () => {
    const { service } = setup();
    await expect(service.reset('inconnu', PWD, now)).resolves.toBe(false);
  });

  it('une nouvelle demande invalide les jetons précédents', async () => {
    const { service, mails } = setup();
    await service.request('alice@example.com', now);
    const first = new URL(
      mails[0].text.match(/https?:\/\/\S+/)![0],
    ).searchParams.get('token')!;
    await service.request('alice@example.com', plus(1));
    await expect(service.reset(first, PWD, plus(2))).resolves.toBe(false);
  });

  it('ne stocke jamais le jeton en clair (SHA-256 hex)', async () => {
    const { service, rows, tokenOf } = setup();
    await service.request('alice@example.com', now);
    const token = tokenOf();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0].tokenHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(rows[0].expiresAt).toEqual(plus(60));
  });

  it('n’envoie rien pour une adresse inconnue', async () => {
    const { service, mails, rows } = setup();
    await service.request('inconnu@example.com', now);
    expect(mails).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it('la réinitialisation invalide aussi les autres jetons encore valides', async () => {
    const { service, tokenOf, rows } = setup();
    await service.request('alice@example.com', now);
    const token = tokenOf();
    // Jeton concurrent resté valide (demandes simultanées).
    rows.push({
      id: 'autre',
      user: { id: 'u1' },
      tokenHash: 'autre-hash',
      expiresAt: plus(30),
      usedAt: null,
    });
    await expect(service.reset(token, PWD, plus(1))).resolves.toBe(true);
    expect(rows.every((r) => r.usedAt !== null)).toBe(true);
  });
});
