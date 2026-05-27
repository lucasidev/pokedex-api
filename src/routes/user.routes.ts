import { Router } from 'express';
import {
  addPokemonToTeam,
  catchPokemon,
  createPoketeam,
  deletePoketeam,
  getPokedex,
  getPoketeam,
  getUserById,
  getUserByToken,
  getUsers,
  releasePokemon,
  removePokemonFromTeam,
  storeUser,
} from '../controllers/users.controller.js';
import { isAdmin, verifyToken } from '../middlewares/authJwt.js';
import { checkExistingUser } from '../middlewares/verifySignUp.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/pokedex', asyncHandler(verifyToken), asyncHandler(getPokedex));
router.put('/pokedex/catch-pokemon', asyncHandler(verifyToken), asyncHandler(catchPokemon));
router.put('/pokedex/release-pokemon', asyncHandler(verifyToken), asyncHandler(releasePokemon));

router.get('/poketeam', asyncHandler(verifyToken), asyncHandler(getPoketeam));
router.put('/poketeam/create', asyncHandler(verifyToken), asyncHandler(createPoketeam));
router.put('/poketeam/delete', asyncHandler(verifyToken), asyncHandler(deletePoketeam));
router.put('/poketeam/add-pokemon', asyncHandler(verifyToken), asyncHandler(addPokemonToTeam));
router.put(
  '/poketeam/remove-pokemon',
  asyncHandler(verifyToken),
  asyncHandler(removePokemonFromTeam),
);

router.get('/', asyncHandler(getUsers));
router.get('/using-token', asyncHandler(verifyToken), asyncHandler(getUserByToken));
router.get('/:id', asyncHandler(getUserById));
router.post(
  '/',
  asyncHandler(verifyToken),
  asyncHandler(isAdmin),
  asyncHandler(checkExistingUser),
  asyncHandler(storeUser),
);

export default router;
