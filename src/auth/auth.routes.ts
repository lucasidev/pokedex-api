import { Router } from 'express';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
import { checkExistingRole, checkExistingUser } from '../users/verifySignUp.middleware.js';
import { signIn, signUp } from './auth.controller.js';

const router = Router();

router.post(
  '/signup',
  asyncHandler(checkExistingUser),
  asyncHandler(async (req, res, next) => {
    checkExistingRole(req, res, next);
  }),
  asyncHandler(signUp),
);

router.post('/signin', asyncHandler(signIn));

export default router;
