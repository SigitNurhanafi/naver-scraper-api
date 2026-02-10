// src/controllers/platforms/shopee.controller.ts
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ScraperFactory } from '../../services/scraper.factory';
import { Logger } from '../../utils/logger';
import { ScrapeResult, ApiSuccessResponse, ApiErrorResponse } from '../../types';

export class ShopeeController {
    static async scrape(req: Request, res: Response): Promise<void> {
        const requestId = randomUUID();
        const logger = new Logger(requestId);

        try {
            const { productUrl } = req.query;

            if (!productUrl || typeof productUrl !== 'string') {
                const response: ApiErrorResponse = { error: 'Missing productUrl' };
                res.status(400).json(response);
                return;
            }

            const scraper = ScraperFactory.getScraper('shopee');
            const data = await scraper.scrape(productUrl, logger) as ScrapeResult;

            const response: ApiSuccessResponse<ScrapeResult> = {
                success: true,
                platform: 'shopee',
                data,
                timestamp: new Date().toISOString(),
                requestId
            };
            res.json(response);

        } catch (error: unknown) {
            await logger.error('Shopee controller error', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            const response: ApiErrorResponse = { error: errorMessage, requestId };
            res.status(500).json(response);
        }
    }
}
