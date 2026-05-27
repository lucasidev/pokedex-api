import type { Request, Response } from 'express';
import { getPokemonByName } from './pokemon.service.js';

export async function getPokemon(req: Request, res: Response): Promise<void> {
  const { name } = req.params as { name: string };
  const pokemon = await getPokemonByName(name);
  res.status(200).json({ status: 'OK', code: 200, result: pokemon });
}
