import { Router } from 'express';
import { signIn, signUp } from '../controllers/auth.controller.js';
import { checkExistingRole, checkExistingUser } from '../middlewares/verifySignUp.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
