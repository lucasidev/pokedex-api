import { Router } from 'express';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
import { getPokemon } from './pokemon.controller.js';

const router = Router();

router.get('/:name', asyncHandler(getPokemon));

export default router;
