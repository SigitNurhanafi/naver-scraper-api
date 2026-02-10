// src/utils/validator.ts

/**
 * Validates a Naver SmartStore product URL with strict regex.
 */
export function isValidNaverUrl(url: string): boolean {
    const pattern = /^https?:\/\/smartstore\.naver\.com\/[^/]+\/products\/\d+/;
    return pattern.test(url);
}

/**
 * Checks if data is valid (non-null, non-empty).
 * Shared validation helper to avoid duplication.
 */
export function isValidData(data: unknown): boolean {
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return true;
}
