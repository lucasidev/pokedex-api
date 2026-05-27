import type { NextFunction, Request, Response } from 'express';
import { Conflict } from '../shared/utils/errors.js';
import { User } from './user.model.js';

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
