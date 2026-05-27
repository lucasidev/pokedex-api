import type { Request, Response } from 'express';
import { getPokemonByName } from '../services/pokemon.service.js';
import { BadRequest } from '../utils/errors.js';

export async function getPokemon(req: Request, res: Response): Promise<void> {
  const { name } = req.params;
  if (!name || name.trim().length === 0) {
    throw BadRequest('pokemon name is required');
  }

  const pokemon = await getPokemonByName(name);
  res.status(200).json({ status: 'OK', code: 200, result: pokemon });
}
