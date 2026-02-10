// src/routes/platforms/naver.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { NaverController } from '../../controllers/platforms/naver.controller';
import { isValidNaverUrl } from '../../utils/validator';

const router = Router();

const validateScrapeRequest = (req: Request, res: Response, next: NextFunction): void => {
    const { productUrl } = req.query;
    if (!productUrl || typeof productUrl !== 'string' || !isValidNaverUrl(productUrl)) {
        res.status(400).json({ error: 'Invalid Naver product URL' });
        return;
    }
    next();
};

router.get('/', validateScrapeRequest, NaverController.scrape);

export default router;
