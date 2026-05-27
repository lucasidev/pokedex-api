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
  res.status(200).json({ status: 'OK', code: 200, result: users });
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = await User.findById(id).select('-password -createdAt -updatedAt');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json({ status: 'OK', code: 200, result: user });
}

export async function getUserByToken(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId).select('-password -createdAt -updatedAt');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json({ status: 'OK', code: 200, result: user });
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

  res.status(201).json({ status: 'Created', code: 201, message: 'User created successfully' });
}

export async function getPokedex(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId).select('pokedex');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json({ status: 'OK', code: 200, result: user.pokedex });
}

export async function catchPokemon(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const user = await User.findById(userId);
  if (!user) {
    throw NotFound('User not found');
  }

  if (user.pokedex.length >= POKEDEX_MAX) {
    throw BadRequest('Your pokedex is full');
  }
  if (user.pokedex.includes(pokemonName)) {
    throw BadRequest('Pokemon already in your pokedex');
  }

  user.pokedex.push(pokemonName);
  await user.save();

  res.status(200).json({ status: 'OK', code: 200, message: 'Pokemon caught' });
}

export async function releasePokemon(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const user = await User.findById(userId);
  if (!user) {
    throw NotFound('User not found');
  }

  user.pokedex = user.pokedex.filter((p) => p !== pokemonName);
  await user.save();

  res.status(200).json({ status: 'OK', code: 200, message: 'Pokemon released' });
}

export async function getPoketeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId).select('poketeam');
  if (!user) {
    throw NotFound('User not found');
  }
  res.status(200).json({ status: 'OK', code: 200, result: user.poketeam });
}

export async function createPoketeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { teamName } = req.body as CreatePoketeamInput;

  const user = await User.findById(userId);
  if (!user) {
    throw NotFound('User not found');
  }

  user.poketeam = { name: teamName, pokemon: [] };
  await user.save();

  res.status(201).json({ status: 'Created', code: 201, message: 'Team created' });
}

export async function deletePoketeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const user = await User.findById(userId);
  if (!user) {
    throw NotFound('User not found');
  }

  user.poketeam = null;
  await user.save();

  res.status(200).json({ status: 'OK', code: 200, message: 'Team deleted' });
}

export async function addPokemonToTeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const user = await User.findById(userId);
  if (!user) {
    throw NotFound('User not found');
  }
  if (!user.poketeam) {
    throw NotFound('Team not found');
  }
  if (user.poketeam.pokemon.length >= POKETEAM_MAX) {
    throw BadRequest('Your team is full');
  }
  if (user.poketeam.pokemon.includes(pokemonName)) {
    throw BadRequest('Pokemon already in your team');
  }

  user.poketeam.pokemon.push(pokemonName);
  user.markModified('poketeam');
  await user.save();

  res.status(200).json({ status: 'OK', code: 200, message: 'Pokemon added to team' });
}

export async function removePokemonFromTeam(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { pokemonName } = req.body as PokemonNameInput;

  const user = await User.findById(userId);
  if (!user) {
    throw NotFound('User not found');
  }
  if (!user.poketeam) {
    throw NotFound('Team not found');
  }

  user.poketeam.pokemon = user.poketeam.pokemon.filter((p) => p !== pokemonName);
  user.markModified('poketeam');
  await user.save();

  res.status(200).json({ status: 'OK', code: 200, message: 'Pokemon removed from team' });
}
