// src/errors/custom.error.ts

export class ScraperError extends Error {
    constructor(message: string, public readonly code: string = 'SCRAPER_ERROR') {
        super(message);
        this.name = 'ScraperError';
    }
}

export class NavigationError extends ScraperError {
    constructor(message: string) {
        super(message, 'NAVIGATION_ERROR');
        this.name = 'NavigationError';
    }
}

export class CaptchaError extends ScraperError {
    constructor(message: string) {
        super(message, 'CAPTCHA_ERROR');
        this.name = 'CaptchaError';
    }
}

export class ProxyError extends ScraperError {
    constructor(message: string) {
        super(message, 'PROXY_ERROR');
        this.name = 'ProxyError';
    }
}
