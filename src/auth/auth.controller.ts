import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../shared/config/env.js';
import { BadRequest, NotFound, Unauthorized } from '../shared/utils/errors.js';
import { RoleModel, type RoleName } from '../users/role.model.js';
import { User } from '../users/user.model.js';

interface SignUpBody {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  roles?: RoleName[];
}

interface SignInBody {
  email?: string;
  password?: string;
}

function signToken(userId: string): string {
  // expiresIn: jsonwebtoken expects a literal StringValue ('1h', '30m', etc.); env.JWT_EXPIRES_IN is a runtime string from env.
  const expiresIn = env.JWT_EXPIRES_IN as SignOptions['expiresIn'];
  return jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn });
}

export async function signUp(req: Request, res: Response): Promise<void> {
  const { name, username, email, password, roles } = req.body as SignUpBody;

  if (!name || !username || !email || !password) {
    throw BadRequest('name, username, email and password are required');
  }

  const roleNames = roles && roles.length > 0 ? roles : ['user'];
  const foundRoles = await RoleModel.find({ name: { $in: roleNames } });
  if (foundRoles.length === 0) {
    throw BadRequest('No valid roles provided');
  }

  const newUser = new User({
    name,
    username,
    email,
    password,
    roles: foundRoles.map((r) => r._id),
    pokedex: [],
    poketeam: null,
  });
  const saved = await newUser.save();

  const token = signToken(saved.id);
  res.status(200).json({ status: 'OK', code: 200, token });
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as SignInBody;

  if (!email || !password) {
    throw BadRequest('email and password are required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw NotFound('User not found');
  }

  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) {
    throw Unauthorized('Invalid password');
  }

  const token = signToken(user.id);
  res.status(200).json({ status: 'OK', code: 200, token });
}
