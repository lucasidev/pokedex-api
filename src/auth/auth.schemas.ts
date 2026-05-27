import { z } from 'zod';

const password = z.string().min(8).max(72);

export const signUpSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password,
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
