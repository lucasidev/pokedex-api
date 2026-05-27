import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { User } from '../../users/user.model.js';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../utils/errors.js';

interface AuthTokenPayload extends JwtPayload {
  id: string;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  const xAccessToken = req.headers['x-access-token'];
  if (typeof xAccessToken === 'string') {
    return xAccessToken;
  }
  return null;
}

export async function verifyToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    throw Unauthorized('No token provided');
  }

  let decoded: AuthTokenPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
  } catch {
    throw Unauthorized('Invalid token');
  }

  if (typeof decoded.id !== 'string') {
    throw Unauthorized('Invalid token');
  }

  req.userId = decoded.id;
  next();
}

export async function isAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    throw Unauthorized();
  }

  const user = await User.findById(req.userId).populate<{ roles: { name: string }[] }>('roles');
  if (!user) {
    throw Unauthorized('User not found');
  }

  const isAdminRole = user.roles.some((r) => r.name === 'admin');
  if (!isAdminRole) {
    throw Forbidden('This operation requires admin role');
  }

  next();
}
