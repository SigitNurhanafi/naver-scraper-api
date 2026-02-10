// src/config/config.ts
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

export const config = {
    server: {
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development'
    },
    scraper: {
        maxConcurrent: Number(process.env.MAX_CONCURRENT) || 5,
        requestTimeout: Number(process.env.REQUEST_TIMEOUT) || 30000,
        navigationTimeout: 60000, // 60s for full page loads
        maxRetries: 3,
        headless: process.env.HEADLESS === 'true'
    },
    proxy: {
        useProxy: process.env.WITH_PROXY === 'true',
        allowDirectFallback: process.env.ALLOW_DIRECT_FALLBACK === 'true'
    },
    naver: {
        baseUrl: 'https://smartstore.naver.com',
        selectors: {
            captchaImage: '#captcha_img_cover',
            productLink: (id: string) => `a[href*="/products/${id}"]`
        }
    }
} as const;
