import { Router } from 'express';
import { AuthController } from './auth.controller';
import { registerUserSchema, loginUserSchema } from '../users/users.validation';
import { validateRequest, authenticate } from '../../shared';

const router: Router = Router();

router.post('/register', validateRequest({ body: registerUserSchema }), AuthController.register);
router.post('/login', validateRequest({ body: loginUserSchema }), AuthController.login);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', AuthController.logout);
router.get('/me', authenticate, AuthController.getMe);

export const authRoutes = router;
