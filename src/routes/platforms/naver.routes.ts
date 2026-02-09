import { Router, Request, Response, NextFunction } from 'express';
import { NaverController } from '../../controllers/platforms/naver.controller';
import { Validator } from '../../utils/validator';

const router = Router();

const validateScrapeRequest = (req: Request, res: Response, next: NextFunction) => {
    const { productUrl } = req.query;
    if (!productUrl || typeof productUrl !== 'string' || !Validator.isValidNaverUrl(productUrl)) {
        return res.status(400).json({ error: 'Invalid Naver product URL' });
    }
    next();
};

router.get('/', validateScrapeRequest, NaverController.scrape);

export default router;
