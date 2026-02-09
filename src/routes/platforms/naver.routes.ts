// src/routes/platforms/naver.routes.ts
import { Router } from 'express';
import { NaverController } from '../../controllers/platforms/naver.controller';

const router = Router();

router.get('/', NaverController.scrape);

export default router;
