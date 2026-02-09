// src/controllers/product.controller.ts
import { Request, Response } from 'express';
import { scraperService } from '../services/scraper.service';
import { Validator } from '../utils/validator';
import { Logger } from '../utils/logger';

export class ProductController {
  async getProduct(req: Request, res: Response) {
    const requestId = Math.random().toString(36).substring(7);
    const logger = new Logger(requestId);

    try {
      const { productUrl } = req.query;

      if (!productUrl || typeof productUrl !== 'string' || !Validator.isValidNaverUrl(productUrl)) {
        logger.log('Invalid request', { productUrl });
        return res.status(400).json({ error: 'Invalid product URL' });
      }

      const data = await scraperService.scrapeProduct(productUrl, logger);

      res.json({
        success: true,
        data: data,
        timestamp: new Date().toISOString(),
        requestId: requestId
      });

    } catch (error: any) {
      logger.error('Final catching error in controller', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
}