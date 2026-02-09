// src/utils/validator.ts
export class Validator {
    static isValidNaverUrl(url: string): boolean {
        return url.includes('smartstore.naver.com') && url.includes('/products/');
    }
}
