import { Request, Response } from 'express';
import { ScraperFactory } from '../../services/scraper.factory';
import { Logger } from '../../utils/logger';
import { Validator } from '../../utils/validator';
import { cacheService } from '../../services/cache.service';

export class NaverController {
    static async scrape(req: Request, res: Response) {
        const requestId = Math.random().toString(36).substring(7);
        const logger = new Logger(requestId);

        try {
            const { productUrl } = req.query;

            if (!productUrl || typeof productUrl !== 'string' || !Validator.isValidNaverUrl(productUrl)) {
                logger.log('Invalid request', { productUrl });
                return res.status(400).json({ error: 'Invalid Naver product URL' });
            }

            // 1. Check Cache First
            const cacheKey = `naver:${productUrl}`;
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                logger.log('[Naver] Returning CACHED data');
                return res.json({
                    success: true,
                    platform: 'naver',
                    fromCache: true,
                    data: cachedData,
                    timestamp: new Date().toISOString(),
                    requestId
                });
            }

            // 2. Scrape if not in cache
            const scraper = ScraperFactory.getScraper('naver');
            const data = await scraper.scrape(productUrl, logger);

            // 3. Save to Cache only if data is complete
            if (data && data.benefits && data.productDetails) {
                cacheService.set(cacheKey, data);
                logger.log('[Naver] Data complete. Saved to cache.');
            } else {
                logger.log('[Naver] Data incomplete. Skipping cache.');
            }

            res.json({
                success: true,
                platform: 'naver',
                fromCache: false,
                data,
                timestamp: new Date().toISOString(),
                requestId
            });

        } catch (error: any) {
            logger.error('Naver controller error', error);
            const status = error.message.includes('PROXY_CONNECTION_FAILED') ? 503 : 500;
            const errorMessage = error.message.includes('PROXY_CONNECTION_FAILED') ? 'proxy error' : error.message;
            res.status(status).json({ error: errorMessage, requestId });
        }
    }
}
