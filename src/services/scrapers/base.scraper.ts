// src/services/scrapers/base.scraper.ts
import { chromium } from 'playwright-extra';
import { BrowserContext, Page } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomFingerprint } from '../../utils/fingerprint';
import { delay, getRandomInt } from '../../utils/delay';
import { config } from '../../config/config';
import { Logger } from '../../utils/logger';
import { isValidData } from '../../utils/validator';
import { proxyManager } from '../../utils/proxy.manager';
import { ProxyConfig, ScrapeResult } from '../../types';
import path from 'path';
import fs from 'fs';
import { ProxyError } from '../../errors/custom.error';

chromium.use(StealthPlugin());

export abstract class BaseScraper {
    protected readonly baseUserDataDir: string;

    constructor(protected readonly platformName: string) {
        this.baseUserDataDir = path.join(process.cwd(), 'user_data', platformName);
        if (!fs.existsSync(this.baseUserDataDir)) {
            fs.mkdirSync(this.baseUserDataDir, { recursive: true });
        }
    }

    /**
     * A wrapper for delay that respects the DISABLE_STEALTH_DELAY flag.
     */
    protected async safeDelay(ms: number): Promise<void> {
        if (!config.scraper.disableStealthDelay) {
            await delay(ms);
        }
    }

    abstract scrape(url: string, logger: Logger): Promise<ScrapeResult>;

    protected async launchContext(logger: Logger): Promise<BrowserContext> {
        const fingerprint = getRandomFingerprint();
        await logger.log(`[${this.platformName}] Active User-Agent: ${fingerprint.userAgent} 🌐`);
        await logger.log(`[${this.platformName}] Using fingerprint`, fingerprint);

        const withProxy = config.proxy.useProxy;
        let activeProxy: ProxyConfig | null = null;

        if (withProxy) {
            // Use ProxyManager for rolling/verified selection
            activeProxy = await proxyManager.getNextProxy(logger);
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

        // Ninja Mode: Isolated Profiles
        const profileSuffix = activeProxy
            ? activeProxy.server.replace(/[^a-zA-Z0-9]/g, '_').slice(-30)
            : 'direct';
        const currentProfileDir = path.join(this.baseUserDataDir, profileSuffix);

        if (activeProxy) {
            options.proxy = {
                server: activeProxy.server,
                username: activeProxy.username,
                password: activeProxy.password
            };
            await logger.log(`[${this.platformName}] Launching with ISOLATED profile: ${profileSuffix}`);
        } else if (withProxy) {
            if (config.proxy.allowDirectFallback) {
                await logger.log(`[${this.platformName}] All proxies failed or filtered. Falling back to DIRECT connection.`);
            } else {
                throw new ProxyError('All proxies in rolling list are unresponsive or flagged as bad.');
            }
        } else {
            await logger.log(`[${this.platformName}] No proxies configured or disabled. Launching DIRECT.`);
        }

        const context = await chromium.launchPersistentContext(currentProfileDir, options);

        // Store active proxy and profile path in context for reporting failures later
        (context as any)._activeProxy = activeProxy;
        (context as any)._profileDir = currentProfileDir;

        return context;
    }

    /**
     * Reports a proxy as bad and CLEANS its associated profile.
     */
    protected markProxyBad(context: BrowserContext, reason: string): void {
        const activeProxy = (context as any)._activeProxy as ProxyConfig | undefined;
        const profileDir = (context as any)._profileDir as string | undefined;

        if (activeProxy) {
            proxyManager.markBad(activeProxy, reason);
        }

        // Ninja Mode: Clean bad profile to avoid tracking
        if (profileDir && fs.existsSync(profileDir)) {
            try {
                // We can't delete while browser is open, so we mark it for next time or just log
            } catch (err) { /* ignore */ }
        }
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
            const scrollCount = getRandomInt(1, 2); // Reduced from 3-6
            for (let i = 0; i < scrollCount; i++) {
                // Randomly choose between wheel scroll and smooth scroll
                if (Math.random() > 0.4) {
                    await page.mouse.wheel(0, getRandomInt(400, 800));
                } else {
                    await page.evaluate(() => window.scrollBy({ top: Math.random() * 400, behavior: 'auto' }));
                }

                await this.safeDelay(getRandomInt(300, 800)); // Reduced from 800-2000

                if (Math.random() > 0.5) {
                    // Jittery mouse movement
                    await page.mouse.move(getRandomInt(100, 600), getRandomInt(100, 600), { steps: 5 });
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
