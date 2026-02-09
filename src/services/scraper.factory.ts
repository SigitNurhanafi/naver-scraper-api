// src/services/scraper.factory.ts
import { NaverScraper } from './scrapers/naver.scraper';
import { ShopeeScraper } from './scrapers/shopee.scraper';
import { BaseScraper } from './scrapers/base.scraper';

export class ScraperFactory {
    static getScraper(platform: string): BaseScraper {
        switch (platform.toLowerCase()) {
            case 'naver':
                return new NaverScraper();
            case 'shopee':
                return new ShopeeScraper();
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
}
