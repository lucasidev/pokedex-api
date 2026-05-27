import { Router } from 'express';
import { validate } from '../shared/middlewares/validate.js';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
import { getPokemon } from './pokemon.controller.js';
import { pokemonNameParamSchema } from './pokemon.schemas.js';

const router = Router();

router.get('/:name', validate({ params: pokemonNameParamSchema }), asyncHandler(getPokemon));

export default router;
