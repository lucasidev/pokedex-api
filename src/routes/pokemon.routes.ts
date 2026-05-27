import { Router } from 'express';
import { getPokemon } from '../controllers/pokemon.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/:name', asyncHandler(getPokemon));

export default router;
