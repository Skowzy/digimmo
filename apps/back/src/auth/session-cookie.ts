import type { CookieOptions } from 'express';
import { loadEnv } from '../config/env';

/** Mêmes options à la pose et à l'effacement du cookie (sinon le navigateur ignore l'effacement). */
export function cookieOptions(
  nodeEnv: string = loadEnv().NODE_ENV,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
  };
}
