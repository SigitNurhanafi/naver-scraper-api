 
// src/routes/product.routes.ts
import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';

const router = Router();
const controller = new ProductController();

router.get('/naver', controller.getProduct);

export default router;