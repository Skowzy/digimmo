import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

export type ErrorBody = { message: string; issues?: string[] };
export type DescribedError = { status: number; body: ErrorBody };

const INTERNAL: DescribedError = {
  status: 500,
  body: { message: 'Erreur interne du serveur.' },
};

type ParserError = { type?: unknown; status?: unknown; expose?: unknown };

/** Transforme n'importe quelle erreur en { status, body } français ; ne divulgue jamais de détail interne. */
export function describeError(err: unknown): DescribedError {
  if (err instanceof HttpException) {
    const status = err.getStatus();
    const res = err.getResponse();
    const raw =
      typeof res === 'string'
        ? res
        : (res as { message?: unknown; issues?: unknown });
    const message = typeof raw === 'string' ? raw : raw.message;
    if (
      status === 404 &&
      typeof message === 'string' &&
      message.startsWith('Cannot ')
    )
      return { status, body: { message: 'Ressource introuvable.' } };
    if (typeof message !== 'string')
      return { status, body: { message: 'Requête invalide.' } };
    const issues =
      typeof raw === 'object' && Array.isArray(raw.issues)
        ? (raw.issues as string[])
        : undefined;
    return { status, body: issues ? { message, issues } : { message } };
  }
  // Erreurs du parseur de corps (body-parser / raw-body) : status < 500 et exposables.
  const e = err as ParserError | null;
  if (
    e &&
    typeof e === 'object' &&
    typeof e.status === 'number' &&
    e.status >= 400 &&
    e.status < 500 &&
    e.expose === true
  ) {
    switch (e.type) {
      case 'entity.too.large':
        return {
          status: 413,
          body: { message: 'Plan trop volumineux (1 Mo maximum).' },
        };
      case 'entity.parse.failed':
        return { status: 400, body: { message: 'JSON invalide.' } };
      case 'charset.unsupported':
      case 'encoding.unsupported':
        return {
          status: 415,
          body: { message: 'Type de contenu non pris en charge.' },
        };
      default:
        return { status: 400, body: { message: 'Requête invalide.' } };
    }
  }
  return INTERNAL;
}

const logger = new Logger('Erreur');

export function respondWithError(err: unknown, res: Response): void {
  const { status, body } = describeError(err);
  if (status >= 500)
    logger.error(
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
  res.status(status).json(body);
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost): void {
    respondWithError(err, host.switchToHttp().getResponse<Response>());
  }
}
