// src/routes/platforms/shopee.routes.ts
import { Router } from 'express';
import { ShopeeController } from '../../controllers/platforms/shopee.controller';

const router = Router();

router.get('/', ShopeeController.scrape);

export default router;
