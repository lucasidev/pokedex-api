import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../shared/config/env.js';
import { BadRequest, Unauthorized } from '../shared/utils/errors.js';
import { RoleModel } from '../users/role.model.js';
import { User } from '../users/user.model.js';
import type { SignInInput, SignUpInput } from './auth.schemas.js';

function signToken(userId: string): string {
  // expiresIn: jsonwebtoken expects a literal StringValue ('1h', '30m', etc.); env.JWT_EXPIRES_IN is a runtime string from env.
  const expiresIn = env.JWT_EXPIRES_IN as SignOptions['expiresIn'];
  return jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn });
}

export async function signUp(req: Request, res: Response): Promise<void> {
  const { name, username, email, password } = req.body as SignUpInput;

  // Public signup never grants admin: roles in the request body are ignored.
  // Admin assignment lives in POST /api/users, which requires verifyToken + isAdmin.
  const userRole = await RoleModel.findOne({ name: 'user' });
  if (!userRole) {
    throw BadRequest('Default user role is missing, contact an administrator');
  }

  const newUser = new User({
    name,
    username,
    email,
    password,
    roles: [userRole._id],
    pokedex: [],
    poketeam: null,
  });
  const saved = await newUser.save();

  const token = signToken(saved.id);
  res.status(201).json({ token });
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as SignInInput;

  const user = await User.findOne({ email });
  // Use the same response for "user does not exist" and "wrong password"
  // so the endpoint cannot be used to enumerate registered emails.
  const passwordMatch = user ? await user.comparePassword(password) : false;
  if (!user || !passwordMatch) {
    throw Unauthorized('Invalid credentials');
  }

  const token = signToken(user.id);
  res.status(200).json({ token });
}
