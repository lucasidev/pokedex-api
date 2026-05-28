import type { Request, Response } from 'express';
import { BadRequest, NotFound, Unauthorized } from '../shared/utils/errors.js';
import { RoleModel } from './role.model.js';
import { User } from './user.model.js';
import type { CreatePoketeamInput, CreateUserInput, PokemonNameInput } from './users.schemas.js';

const POKEDEX_MAX = 5;
const POKETEAM_MAX = 3;

function requireUserId(req: Request): string {
  if (!req.userId) {
    throw Unauthorized();
  }
  return req.userId;
}

export async function getUsers(_req: Request, res: Response): Promise<void> {
  const users = await User.find().select('-password -createdAt -updatedAt');
  res.status(200).json(users);
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = await User.findById(id).select('-password -createdAt -updatedAt');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json(user);
}

export async function getUserByToken(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId).select('-password -createdAt -updatedAt');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json(user);
}

export async function storeUser(req: Request, res: Response): Promise<void> {
  const { name, username, password, email, roles } = req.body as CreateUserInput;

  const roleNames = roles && roles.length > 0 ? roles : ['user'];
  const foundRoles = await RoleModel.find({ name: { $in: roleNames } });
  if (foundRoles.length !== roleNames.length) {
    throw BadRequest('One or more roles do not exist');
  }

  const user = new User({
    name,
    username,
    password,
    email,
    pokedex: [],
    poketeam: null,
    roles: foundRoles.map((r) => r._id),
  });
  await user.save();

  const created = await User.findById(user._id).select('-password -createdAt -updatedAt');
  res.status(201).json(created);
}

export async function getPokedex(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId).select('pokedex');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json(user.pokedex);
}

export async function catchPokemon(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  // Atomic catch: only updates if the pokedex is below capacity and does
  // not already contain the name. Avoids the read/mutate/save race when
  // two requests from the same user arrive concurrently.
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $lt: [{ $size: '$pokedex' }, POKEDEX_MAX] },
      pokedex: { $ne: pokemonName },
    },
    { $addToSet: { pokedex: pokemonName } },
    { new: true },
  );

  if (!updated) {
    const user = await User.findById(userId).select('pokedex');
    if (!user) throw NotFound('User not found');
    if (user.pokedex.length >= POKEDEX_MAX) throw BadRequest('Your pokedex is full');
    if (user.pokedex.includes(pokemonName)) throw BadRequest('Pokemon already in your pokedex');
    throw BadRequest('Could not catch pokemon');
  }

  res.status(204).end();
}

export async function releasePokemon(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $pull: { pokedex: pokemonName } },
    { new: true },
  );

  if (!updated) {
    throw NotFound('User not found');
  }

  res.status(204).end();
}

export async function getPoketeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId).select('poketeam');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json(user.poketeam);
}

export async function createPoketeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { teamName } = req.body as CreatePoketeamInput;

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { poketeam: { name: teamName, pokemon: [] } } },
    { new: true },
  );

  if (!updated) {
    throw NotFound('User not found');
  }

  res.status(204).end();
}

export async function deletePoketeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { poketeam: null } },
    { new: true },
  );

  if (!updated) {
    throw NotFound('User not found');
  }

  res.status(204).end();
}

export async function addPokemonToTeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      poketeam: { $ne: null },
      $expr: { $lt: [{ $size: '$poketeam.pokemon' }, POKETEAM_MAX] },
      'poketeam.pokemon': { $ne: pokemonName },
    },
    { $addToSet: { 'poketeam.pokemon': pokemonName } },
    { new: true },
  );

  if (!updated) {
    const user = await User.findById(userId).select('poketeam');
    if (!user) throw NotFound('User not found');
    if (!user.poketeam) throw NotFound('Team not found');
    if (user.poketeam.pokemon.length >= POKETEAM_MAX) throw BadRequest('Your team is full');
    if (user.poketeam.pokemon.includes(pokemonName)) {
      throw BadRequest('Pokemon already in your team');
    }
    throw BadRequest('Could not add pokemon to team');
  }

  res.status(204).end();
}

export async function removePokemonFromTeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const updated = await User.findOneAndUpdate(
    { _id: userId, poketeam: { $ne: null } },
    { $pull: { 'poketeam.pokemon': pokemonName } },
    { new: true },
  );

  if (!updated) {
    const user = await User.findById(userId).select('poketeam');
    if (!user) throw NotFound('User not found');
    if (!user.poketeam) throw NotFound('Team not found');
    throw BadRequest('Could not remove pokemon from team');
  }

  res.status(204).end();
}
