import { Router } from 'express';
import { validate } from '../shared/middlewares/validate.js';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
import { signIn, signUp } from './auth.controller.js';
import { signInSchema, signUpSchema } from './auth.schemas.js';

const router = Router();

router.post('/signup', validate({ body: signUpSchema }), asyncHandler(signUp));
router.post('/signin', validate({ body: signInSchema }), asyncHandler(signIn));

export default router;
