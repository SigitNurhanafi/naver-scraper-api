// src/services/scrapers/base.scraper.ts
import { chromium } from 'playwright-extra';
import { BrowserContext, Page } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomFingerprint } from '../../utils/fingerprint';
import { delay, getRandomDelay } from '../../utils/delay';
import { Logger } from '../../utils/logger';
import { isProxyWorking, getProxyList, ProxyConfig } from '../../utils/proxy.validator';
import path from 'path';
import fs from 'fs';

chromium.use(StealthPlugin());

export abstract class BaseScraper {
    protected userDataDir: string;

    constructor(protected platformName: string) {
        this.userDataDir = path.join(process.cwd(), 'user_data', platformName);
        if (!fs.existsSync(this.userDataDir)) {
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
    }

    abstract scrape(url: string, logger: Logger): Promise<any>;

    protected async launchContext(logger: Logger) {
        const fingerprint = getRandomFingerprint();
        logger.log(`[${this.platformName}] Using fingerprint`, fingerprint);

        const withProxy = process.env.WITH_PROXY === 'true';
        const proxyList = withProxy ? getProxyList() : [];
        let activeProxy: ProxyConfig | null = null;

        if (withProxy) {
            // Rolling Proxy Logic
            for (const proxy of proxyList) {
                const isWorking = await isProxyWorking(logger, proxy);
                if (isWorking) {
                    activeProxy = proxy;
                    break;
                }
            }
        }

        const options: any = {
            headless: process.env.HEADLESS !== 'false', // Default to true (Headless)
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-webrtc',
                '--disable-features=WebRtcHideLocalIpsWithMdns',
                '--disable-device-discovery-notifications',
                '--disable-extensions'
            ],
            userAgent: fingerprint.userAgent,
            viewport: fingerprint.viewport,
            locale: 'ko-KR',
            timezoneId: 'Asia/Seoul',
            javaScriptEnabled: true,
            permissions: ['geolocation'],
        };

        if (activeProxy) {
            options.proxy = {
                server: activeProxy.server,
                username: activeProxy.username,
                password: activeProxy.password
            };
            logger.log(`[${this.platformName}] Launching WITH proxy (Rolling/Verified)`);
        } else if (proxyList.length > 0) {
            if (process.env.ALLOW_DIRECT_FALLBACK === 'true' || !process.env.PROXY_URL) {
                logger.log(`[${this.platformName}] All proxies failed. Falling back to DIRECT connection.`);
            } else {
                throw new Error('PROXY_CONNECTION_FAILED: All proxies in rolling list are unresponsive.');
            }
        } else {
            logger.log(`[${this.platformName}] No proxies configured. Launching DIRECT.`);
        }

        const context = await chromium.launchPersistentContext(this.userDataDir, options);
        return context;
    }

    protected async setupPage(page: Page) {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // @ts-ignore
            window.chrome = { runtime: {} };
        });
    }

    protected async scrollToBottom(page: Page, logger: Logger) {
        logger.log(`[${this.platformName}] Scrolling to bottom...`);
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 400;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }

    protected async simulateHumanBehavior(page: Page) {
        try {
            if (page.isClosed()) return;
            const scrollCount = getRandomDelay(2, 4);
            for (let i = 0; i < scrollCount; i++) {
                await page.mouse.wheel(0, getRandomDelay(300, 800));
                await delay(getRandomDelay(600, 1200));
                if (Math.random() > 0.6) {
                    await page.mouse.move(getRandomDelay(200, 700), getRandomDelay(200, 700), { steps: 5 });
                }
            }
            await page.mouse.move(getRandomDelay(200, 600), getRandomDelay(200, 600));
        } catch (e) { }
    }

    protected isValidData(data: any): boolean {
        if (!data) return false;
        if (Array.isArray(data)) return data.length > 0;
        if (typeof data === 'object') return Object.keys(data).length > 0;
        return true;
    }

    protected async safeEvaluate(page: Page, fn: () => any) {
        try {
            if (page.isClosed()) return null;
            return await page.evaluate(fn);
        } catch (e) {
            return null;
        }
    }

    protected async waitForResponses(responses: any, logger: Logger, timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            // Require BOTH essential data points for a successful scrape (must be non-empty)
            if (this.isValidData(responses.benefits) && this.isValidData(responses.productDetails)) {
                logger.log(`[${this.platformName}] All target responses captured ✅`);
                return;
            }
            await delay(1000);
        }

        const missing = [];
        if (!responses.benefits) missing.push('benefits');
        if (!responses.productDetails) missing.push('productDetails');
        logger.log(`[${this.platformName}] Warning: Missing responses: ${missing.join(', ')} ⚠️`);
    }
}
