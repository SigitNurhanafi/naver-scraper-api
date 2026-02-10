// src/controllers/platforms/naver.controller.ts
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ScraperFactory } from '../../services/scraper.factory';
import { Logger } from '../../utils/logger';
import { isValidData } from '../../utils/validator';
import { cacheService } from '../../services/cache.service';
import { NaverResponses, ApiSuccessResponse, ApiErrorResponse } from '../../types';

export class NaverController {
    static async scrape(req: Request, res: Response): Promise<void> {
        const requestId = randomUUID();
        const logger = new Logger(requestId);

        try {
            const productUrl = req.query.productUrl as string;

            // Validation handled in route middleware

            // 1. Check Cache First
            const cacheKey = `naver:${productUrl}`;
            const cachedData = cacheService.get<NaverResponses>(cacheKey);
            if (cachedData) {
                await logger.log('[Naver] Returning CACHED data');
                const response: ApiSuccessResponse<NaverResponses> = {
                    success: true,
                    platform: 'naver',
                    fromCache: true,
                    data: cachedData,
                    timestamp: new Date().toISOString(),
                    requestId
                };
                res.json(response);
                return;
            }

            // 2. Scrape if not in cache
            const scraper = ScraperFactory.getScraper('naver');
            const data = await scraper.scrape(productUrl, logger) as unknown as NaverResponses;

            // 3. Save to Cache only if data is complete and NOT empty
            if (data && isValidData(data.benefits) && isValidData(data.productDetails)) {
                cacheService.set(cacheKey, data);
                await logger.log('[Naver] Data complete. Saved to cache.');
            } else {
                await logger.log('[Naver] Data incomplete or empty. Skipping cache.');
            }

            const response: ApiSuccessResponse<NaverResponses> = {
                success: true,
                platform: 'naver',
                fromCache: false,
                data,
                timestamp: new Date().toISOString(),
                requestId
            };
            res.json(response);

        } catch (error: unknown) {
            await logger.error('Naver controller error', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const status = errorMessage.includes('PROXY_CONNECTION_FAILED') ? 503 : 500;
            const displayMessage = errorMessage.includes('PROXY_CONNECTION_FAILED') ? 'proxy error' : errorMessage;
            const response: ApiErrorResponse = { error: displayMessage, requestId };
            res.status(status).json(response);
        }
    }
}
