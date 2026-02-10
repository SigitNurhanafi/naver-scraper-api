// src/utils/naver.utils.ts
import { ScraperError } from '../errors/custom.error';

export const NAVER_CONSTANTS = {
    URL_REGEX: /smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/,
    API_PATHS: {
        BENEFITS: ['/benefits/', '/grade-benefits', '/benefit-list'],
        PRODUCTS: ['/products/', '/i/v2/'],
        IGNORE_LOGS: ['/api', '/i/', '/benefits/']
    }
} as const;

export function parseNaverUrl(url: string): { storeName: string; productId: string } {
    const match = url.match(NAVER_CONSTANTS.URL_REGEX);
    if (!match) throw new ScraperError('Invalid Naver URL - Format mismatch');
    return { storeName: match[1], productId: match[2] };
}

export function isBenefitUrl(url: string): boolean {
    return NAVER_CONSTANTS.API_PATHS.BENEFITS.some(path => url.includes(path));
}

export function isProductDetailsUrl(url: string): boolean {
    // strict check for product details to avoid false positives
    return NAVER_CONSTANTS.API_PATHS.PRODUCTS.every(path => url.includes(path)) && url.includes('withWindow=false');
}

export function shouldIgnoreLog(url: string): boolean {
    return url.includes('smartstore.naver.com') && NAVER_CONSTANTS.API_PATHS.IGNORE_LOGS.some(path => url.includes(path));
}
