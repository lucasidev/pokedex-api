import { z } from 'zod';
import { ROLES } from './role.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  roles: z.array(z.enum(ROLES)).optional(),
});

export const pokemonNameBodySchema = z.object({
  pokemonName: z.string().min(1).max(50),
});

export const createPoketeamSchema = z.object({
  teamName: z.string().min(1).max(50),
});

export const userIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid user id'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PokemonNameInput = z.infer<typeof pokemonNameBodySchema>;
export type CreatePoketeamInput = z.infer<typeof createPoketeamSchema>;
