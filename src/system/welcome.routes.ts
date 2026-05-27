import { Router } from 'express';
import { welcome } from './welcome.controller.js';

const router = Router();

router.get('/', welcome);

export default router;
