import type { CookieOptions } from 'express';
import { loadEnv } from '../config/env';

/** Mêmes options à la pose et à l'effacement du cookie (sinon le navigateur ignore l'effacement). */
export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: loadEnv().NODE_ENV === 'production',
    path: '/',
  };
}
