import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const cjs = new URL('../dist/index.cjs', import.meta.url);

describe('build CJS', () => {
  it.skipIf(!existsSync(cjs))('import CJS fonctionne (dist absent : lancer npm run build -w @digimmo/domain)', () => {
    const require = createRequire(import.meta.url);
    const mod = require('../dist/index.cjs');
    expect(typeof mod.validatePlan).toBe('function');
  });
});
