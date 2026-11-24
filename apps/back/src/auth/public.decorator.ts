import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marque une route comme ouverte (hors SessionGuard global). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
