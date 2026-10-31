import { Router } from 'express';
import { HealthController } from './health.controller';

const router: Router = Router();

router.get('/', HealthController.getHealth);

export const healthRoutes = router;
