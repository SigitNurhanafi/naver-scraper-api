// src/utils/naver.utils.ts
import { ScraperError } from '../errors/custom.error';

export const NAVER_CONSTANTS = {
    URL_REGEX: /smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/,
    API_PATHS: {
        BENEFITS: [
            /\/benefits\/by-product/,
        ],
        // Strict pattern: /i/v2/channels/{channel_id}/products/{product_id}
        PRODUCTS_REGEX: /\/i\/v2\/channels\/[^\/]+\/products\/\d+/,
        IGNORE_LOGS: ['/api', '/i/', '/benefits/']
    }
} as const;

export function parseNaverUrl(url: string): { storeName: string; productId: string } {
    const match = url.match(NAVER_CONSTANTS.URL_REGEX);
    if (!match) throw new ScraperError('Invalid Naver URL - Format mismatch');
    return { storeName: match[1], productId: match[2] };
}

export function isBenefitUrl(url: string): boolean {
    // Strict regex check to avoid false positives (e.g. /benefits/other-promo)
    return NAVER_CONSTANTS.API_PATHS.BENEFITS.some(pattern => pattern.test(url));
}

export function isProductDetailsUrl(url: string): boolean {
    // strict check for product details: /i/v2/channels/.../products/... AND withWindow=false
    return NAVER_CONSTANTS.API_PATHS.PRODUCTS_REGEX.test(url) && url.includes('withWindow=false');
}

export function shouldIgnoreLog(url: string): boolean {
    return url.includes('smartstore.naver.com') && NAVER_CONSTANTS.API_PATHS.IGNORE_LOGS.some(path => url.includes(path));
}
