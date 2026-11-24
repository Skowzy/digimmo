import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.strictObject({ a: z.number() }));

  it('renvoie la donnée parsée', () => {
    expect(pipe.transform({ a: 1 })).toEqual({ a: 1 });
  });

  it('lève une BadRequestException avec la liste des problèmes', () => {
    try {
      pipe.transform({ a: 1, b: 2 });
      throw new Error('aurait dû lever');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = (e as BadRequestException).getResponse() as {
        message: string;
        issues: string[];
      };
      expect(body.message).toBe('Données invalides');
      expect(body.issues.length).toBeGreaterThan(0);
    }
  });
});
