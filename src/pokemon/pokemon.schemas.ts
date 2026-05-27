import { z } from 'zod';

export const pokemonNameParamSchema = z.object({
  name: z.string().min(1).max(50),
});
