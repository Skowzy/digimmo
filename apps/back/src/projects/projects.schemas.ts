import { ruleParamsSchema } from '@digimmo/domain';
import { z } from 'zod';

const terrainSchema = z.strictObject({
  widthCm: z.number().int().min(500).max(100000),
  depthCm: z.number().int().min(500).max(100000),
  street: z.enum(['north', 'south', 'east', 'west']),
});

export const createProjectSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  terrain: terrainSchema,
  rules: ruleParamsSchema.optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Au moins un champ est requis.',
  });
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
