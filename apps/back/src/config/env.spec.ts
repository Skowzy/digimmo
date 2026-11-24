import { loadEnv } from './env';

const complete = {
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgres://digimmo:digimmo@localhost:5432/digimmo_test',
  MONGO_URL: 'mongodb://localhost:27017/digimmo_test',
  JWT_SECRET: 'a-very-long-secret-of-at-least-32-chars!!',
  FRONT_ORIGIN: 'http://localhost:5173',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Digimmo <no-reply@digimmo.local>',
};

describe('loadEnv', () => {
  it('renvoie des valeurs typées pour une configuration complète', () => {
    const env = loadEnv(complete);
    expect(env.PORT).toBe(4000);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.NODE_ENV).toBe('test');
  });

  it('applique les valeurs par défaut de NODE_ENV et PORT', () => {
    const rest: Record<string, string> = { ...complete };
    delete rest.NODE_ENV;
    delete rest.PORT;
    const env = loadEnv(rest);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
  });

  it('refuse un JWT_SECRET trop court en nommant la variable', () => {
    expect(() => loadEnv({ ...complete, JWT_SECRET: 'court-10ch' })).toThrow(
      /JWT_SECRET/,
    );
  });
});
