import { z } from 'zod';

export const furnitureItemSchema = z.strictObject({
  category: z.enum(['chambre', 'cuisine', 'sdb', 'sejour', 'autre']),
  name: z.string().min(1).max(60),
  widthCm: z.number().int().min(1).max(1000),
  depthCm: z.number().int().min(1).max(1000),
  symbol: z.string().min(1).max(40),
});
export type FurnitureItemDto = z.infer<typeof furnitureItemSchema>;

export const furnitureItemPatchSchema = furnitureItemSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Au moins un champ est requis.',
  });
export type FurnitureItemPatchDto = z.infer<typeof furnitureItemPatchSchema>;
