import type { NextFunction, Request, Response } from 'express';
import { ROLES, type RoleName } from '../models/Role.js';
import { User } from '../models/User.js';
import { BadRequest, Conflict } from '../utils/errors.js';

export async function checkExistingUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const { username, email } = req.body as { username?: string; email?: string };

  if (username) {
    const existing = await User.findOne({ username });
    if (existing) {
      throw Conflict('User already exists');
    }
  }

  if (email) {
    const existing = await User.findOne({ email });
    if (existing) {
      throw Conflict('Email already exists');
    }
  }

  next();
}

export function checkExistingRole(req: Request, _res: Response, next: NextFunction): void {
  const { roles } = req.body as { roles?: unknown };

  if (roles === undefined || roles === null) {
    next();
    return;
  }

  if (!Array.isArray(roles)) {
    throw BadRequest('roles must be an array');
  }

  for (const role of roles) {
    if (typeof role !== 'string' || !ROLES.includes(role as RoleName)) {
      throw BadRequest(`Role ${String(role)} does not exist`);
    }
  }

  next();
}
