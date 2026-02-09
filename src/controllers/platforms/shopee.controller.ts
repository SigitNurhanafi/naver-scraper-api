// src/controllers/platforms/shopee.controller.ts
import { Request, Response } from 'express';
import { ScraperFactory } from '../../services/scraper.factory';
import { Logger } from '../../utils/logger';

export class ShopeeController {
    static async scrape(req: Request, res: Response) {
        const requestId = Math.random().toString(36).substring(7);
        const logger = new Logger(requestId);

        try {
            const { productUrl } = req.query;

            if (!productUrl || typeof productUrl !== 'string') {
                return res.status(400).json({ error: 'Missing productUrl' });
            }

            const scraper = ScraperFactory.getScraper('shopee');
            const data = await scraper.scrape(productUrl, logger);

            res.json({
                success: true,
                platform: 'shopee',
                data,
                timestamp: new Date().toISOString(),
                requestId
            });

        } catch (error: any) {
            logger.error('Shopee controller error', error);
            res.status(500).json({ error: error.message, requestId });
        }
    }
}
