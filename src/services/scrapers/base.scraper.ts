// src/services/scrapers/base.scraper.ts
import { chromium } from 'playwright-extra';
import { BrowserContext, Page } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomFingerprint } from '../../utils/fingerprint';
import { delay, getRandomInt } from '../../utils/delay';
import { config } from '../../config/config';
import { Logger } from '../../utils/logger';
import { isValidData } from '../../utils/validator';
import { isProxyWorking, getProxyList } from '../../utils/proxy.validator';
import { ProxyConfig, ScrapeResult } from '../../types';
import path from 'path';
import fs from 'fs';
import { ProxyError } from '../../errors/custom.error';

chromium.use(StealthPlugin());

export abstract class BaseScraper {
    protected readonly userDataDir: string;

    constructor(protected readonly platformName: string) {
        this.userDataDir = path.join(process.cwd(), 'user_data', platformName);
        if (!fs.existsSync(this.userDataDir)) {
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
    }

    abstract scrape(url: string, logger: Logger): Promise<ScrapeResult>;

    protected async launchContext(logger: Logger): Promise<BrowserContext> {
        const fingerprint = getRandomFingerprint();
        await logger.log(`[${this.platformName}] Using fingerprint`, fingerprint);

        const withProxy = config.proxy.useProxy;
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

        const options: Record<string, unknown> = {
            headless: config.scraper.headless, // Default to true (Headless)
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
            await logger.log(`[${this.platformName}] Launching WITH proxy (Rolling/Verified)`);
        } else if (proxyList.length > 0) {
            if (config.proxy.allowDirectFallback) {
                await logger.log(`[${this.platformName}] All proxies failed. Falling back to DIRECT connection.`);
            } else {
                throw new ProxyError('All proxies in rolling list are unresponsive.');
            }
        } else {
            await logger.log(`[${this.platformName}] No proxies configured. Launching DIRECT.`);
        }

        const context = await chromium.launchPersistentContext(this.userDataDir, options);
        return context;
    }

    protected async setupPage(page: Page): Promise<void> {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // @ts-ignore
            window.chrome = { runtime: {} };
        });
    }

    protected async scrollToBottom(page: Page, logger: Logger): Promise<void> {
        await logger.log(`[${this.platformName}] Scrolling to bottom...`);
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

    protected async simulateHumanBehavior(page: Page): Promise<void> {
        try {
            if (page.isClosed()) return;
            const scrollCount = getRandomInt(2, 4);
            for (let i = 0; i < scrollCount; i++) {
                await page.mouse.wheel(0, getRandomInt(300, 800));
                await delay(getRandomInt(600, 1200));
                if (Math.random() > 0.6) {
                    await page.mouse.move(getRandomInt(200, 700), getRandomInt(200, 700), { steps: 5 });
                }
            }
            await page.mouse.move(getRandomInt(200, 600), getRandomInt(200, 600));
        } catch { /* page may have navigated away */ }
    }

    protected async safeEvaluate<T>(page: Page, fn: () => T): Promise<T | null> {
        try {
            if (page.isClosed()) return null;
            return await page.evaluate(fn);
        } catch {
            return null;
        }
    }

    protected async waitForResponses(
        responses: { benefits: unknown; productDetails: unknown },
        logger: Logger,
        timeout = 15000
    ): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            // Require BOTH essential data points for a successful scrape (must be non-empty)
            if (isValidData(responses.benefits) && isValidData(responses.productDetails)) {
                await logger.log(`[${this.platformName}] All target responses captured ✅`);
                return;
            }
            await delay(1000);
        }

        const missing: string[] = [];
        if (!responses.benefits) missing.push('benefits');
        if (!responses.productDetails) missing.push('productDetails');
        await logger.log(`[${this.platformName}] Warning: Missing responses: ${missing.join(', ')} ⚠️`);
    }
}
