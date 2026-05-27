import { Router } from 'express';
import { isAdmin, verifyToken } from '../shared/middlewares/authJwt.js';
import { validate } from '../shared/middlewares/validate.js';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
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
} from './users.controller.js';
import {
  createPoketeamSchema,
  createUserSchema,
  pokemonNameBodySchema,
  userIdParamSchema,
} from './users.schemas.js';

const router = Router();

router.get('/pokedex', asyncHandler(verifyToken), asyncHandler(getPokedex));
router.put(
  '/pokedex/catch-pokemon',
  asyncHandler(verifyToken),
  validate({ body: pokemonNameBodySchema }),
  asyncHandler(catchPokemon),
);
router.put(
  '/pokedex/release-pokemon',
  asyncHandler(verifyToken),
  validate({ body: pokemonNameBodySchema }),
  asyncHandler(releasePokemon),
);

router.get('/poketeam', asyncHandler(verifyToken), asyncHandler(getPoketeam));
router.put(
  '/poketeam/create',
  asyncHandler(verifyToken),
  validate({ body: createPoketeamSchema }),
  asyncHandler(createPoketeam),
);
router.put('/poketeam/delete', asyncHandler(verifyToken), asyncHandler(deletePoketeam));
router.put(
  '/poketeam/add-pokemon',
  asyncHandler(verifyToken),
  validate({ body: pokemonNameBodySchema }),
  asyncHandler(addPokemonToTeam),
);
router.put(
  '/poketeam/remove-pokemon',
  asyncHandler(verifyToken),
  validate({ body: pokemonNameBodySchema }),
  asyncHandler(removePokemonFromTeam),
);

router.get('/', asyncHandler(verifyToken), asyncHandler(isAdmin), asyncHandler(getUsers));
router.get('/using-token', asyncHandler(verifyToken), asyncHandler(getUserByToken));
router.get(
  '/:id',
  asyncHandler(verifyToken),
  validate({ params: userIdParamSchema }),
  asyncHandler(getUserById),
);
router.post(
  '/',
  asyncHandler(verifyToken),
  asyncHandler(isAdmin),
  validate({ body: createUserSchema }),
  asyncHandler(storeUser),
);

export default router;
