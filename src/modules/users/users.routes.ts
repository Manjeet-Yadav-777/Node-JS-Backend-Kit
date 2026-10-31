import { Router } from 'express';
import { UsersController } from './users.controller';
import { registerUserSchema, updateUserSchema, queryUsersSchema } from './users.validation';
import { validateRequest } from '../../shared';

const router: Router = Router();

router.post('/', validateRequest({ body: registerUserSchema }), UsersController.createUser);
router.get('/', validateRequest({ query: queryUsersSchema }), UsersController.listUsers);
router.get('/:id', UsersController.getUserById);
router.patch('/:id', validateRequest({ body: updateUserSchema }), UsersController.updateUser);

export const userRoutes = router;
