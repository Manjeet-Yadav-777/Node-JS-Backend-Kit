import { Router } from 'express';
import { HealthController } from './health.controller';

const router: Router = Router();

router.get('/', HealthController.getHealth);
router.get('/live', HealthController.getLiveness);
router.get('/ready', HealthController.getReadiness);

export const healthRoutes = router;
