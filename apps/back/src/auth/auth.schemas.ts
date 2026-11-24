import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(254);

export const registerSchema = z.strictObject({
  email,
  password: z.string().min(10).max(128),
});

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128),
});

export const forgotSchema = z.strictObject({ email });

export const resetSchema = z.strictObject({
  token: z.string().min(1).max(200),
  password: z.string().min(10).max(128),
});

export type ForgotDto = z.infer<typeof forgotSchema>;
export type ResetDto = z.infer<typeof resetSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
