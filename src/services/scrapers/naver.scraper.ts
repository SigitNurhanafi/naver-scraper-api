// src/services/scrapers/naver.scraper.ts
import { BaseScraper } from './base.scraper';
import { Logger } from '../../utils/logger';
import { isValidData } from '../../utils/validator';
import { NaverResponses, ScrapeResult } from '../../types';
import { Page } from 'playwright';
import { delay, getRandomInt } from '../../utils/delay';

export class NaverScraper extends BaseScraper {
    constructor() {
        super('naver');
    }

    async scrape(productUrl: string, logger: Logger): Promise<ScrapeResult> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const { storeName, productId } = this.parseUrl(productUrl);
            const context = await this.launchContext(logger);

            const responses: NaverResponses = {
                benefits: null,
                productDetails: null
            };

            try {
                await logger.log(`[Naver] Scrape attempt ${attempt}/${maxRetries}`);
                const page = await context.newPage();
                await this.setupPage(page);

                // 1. Setup Interceptor
                this.setupResponseInterceptor(page, responses, logger);

                // 2. Ninja Navigation (Browse First Strategy)
                await this.performNinjaNavigation(page, storeName, productId, productUrl, logger);

                // 3. CAPTCHA Check
                await this.detectAndSolveCaptcha(page, logger);

                if (page.isClosed()) throw new Error('Target closed');

                // 4. Stable Verification (Scroll + Early Exit)
                await this.scrollToBottom(page, logger);

                // 5. Data Validation & Return
                if (isValidData(responses.benefits) && isValidData(responses.productDetails)) {
                    await logger.log(`[Naver] Attempt ${attempt} Success! All data captured.`);
                    await context.close().catch(() => { });
                    return { ...responses };
                } else {
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                    await this.waitForResponses(responses, logger, 10000);

                    if (isValidData(responses.benefits) && isValidData(responses.productDetails)) {
                        await logger.log(`[Naver] Attempt ${attempt} Success! All data captured after wait.`);
                        await context.close().catch(() => { });
                        return { ...responses };
                    } else {
                        const missing = !isValidData(responses.benefits) ? 'benefits' : (!isValidData(responses.productDetails) ? 'productDetails' : 'unknown');
                        await logger.log(`[Naver] Attempt ${attempt} failed: ${missing} missing/empty. Retrying... 🔄`);
                    }
                }

            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                await logger.error(`[Naver] Attempt ${attempt} crashed`, error);
            } finally {
                await context.close().catch(() => { });
                await logger.log(`[Naver] Session ended for attempt ${attempt}`);
            }

            if (attempt < maxRetries) {
                await delay(2000); // Cool down before retry
            }
        }

        throw lastError || new Error('Naver scraper failed after max retries (Incomplete data)');
    }

    private setupResponseInterceptor(page: Page, responses: NaverResponses, logger: Logger): void {
        page.on('response', async (response) => {
            const url = response.url();
            const status = response.status();

            if (url.includes('smartstore.naver.com') && (url.includes('/api') || url.includes('/i/') || url.includes('/benefits/'))) {
                // Suppress noisy logs during retries unless error
                if (status >= 400) await logger.log(`[Naver] Intercepted Error: [${status}] ${url}`);
            }

            try {
                if (page.isClosed()) return;
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const data: unknown = await response.json().catch(() => null);
                    if (!data) return;

                    if (url.includes('/benefits/') || url.includes('/grade-benefits') || url.includes('/benefit-list')) {
                        responses.benefits = data as NaverResponses['benefits'];
                        await logger.log(`[Naver] Captured benefits data (Status: ${status})`);
                    } else if (url.includes('/products/') && url.includes('/i/v2/') && url.includes('withWindow=false')) {
                        responses.productDetails = data as NaverResponses['productDetails'];
                        await logger.log(`[Naver] Captured productDetails data (Status: ${status})`);
                    }
                }
            } catch { /* response may have been consumed */ }
        });
    }

    private async performNinjaNavigation(
        page: Page,
        storeName: string,
        productId: string,
        directUrl: string,
        logger: Logger
    ): Promise<void> {
        let clicked = false;
        const productLinkSelector = `a[href*="/products/${productId}"]`;

        // 🔄 Strategy 1: Browse Store Home (Prioritas Utama)
        await logger.log(`[Naver] Strategy 1: Browse Store Home for Product ID ${productId} 🏠`);
        const storeUrl = `https://smartstore.naver.com/${storeName}/`;
        await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
        await delay(getRandomInt(2000, 3000));

        const maxScrolls = getRandomInt(3, 5);
        for (let i = 0; i < maxScrolls; i++) {
            const productLink = await page.$(productLinkSelector);
            if (productLink && await productLink.isVisible()) {
                await logger.log(`[Naver] Found link on Home! Clicking...`);
                await productLink.scrollIntoViewIfNeeded();
                await delay(getRandomInt(800, 1500));
                await productLink.click();
                clicked = true;
                break;
            }

            await logger.log(`[Naver] Product not visible, scrolling... (${i + 1}/${maxScrolls})`);
            await page.mouse.wheel(0, getRandomInt(400, 900));
            await delay(getRandomInt(1000, 2000));

            if (Math.random() > 0.6) {
                await page.mouse.move(getRandomInt(200, 600), getRandomInt(200, 600), { steps: 5 });
            }
        }

        if (!clicked) {
            // Check one last time at top of page before giving up on browse
            await logger.log(`[Naver] Checking top of page before giving up on Browse...`);
            await page.evaluate(() => window.scrollTo(0, 0));
            await delay(1000);
            const finalCheck = await page.$(productLinkSelector).catch(() => null);
            if (finalCheck) {
                await finalCheck.click();
                clicked = true;
            }
        }

        // 🆕 Strategy 2: Search via Store (Fallback)
        if (!clicked) {
            await logger.log(`[Naver] Strategy 1 Failed. Fallback to Strategy 2: Search Product 🔍`);
            const searchUrl = `https://smartstore.naver.com/${storeName}/search?q=${productId}`;

            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
            await delay(getRandomInt(2000, 3000));

            const searchLink = await page.$(productLinkSelector);
            if (searchLink) {
                await logger.log(`[Naver] Found via Search! Clicking...`);
                await searchLink.scrollIntoViewIfNeeded();
                await delay(getRandomInt(800, 1500));
                await searchLink.click();
                clicked = true;
            }
        }

        // 🔄 Strategy 3: Last Resort (Direct Navigation)
        if (clicked) {
            // Wait for navigation after click
            await page.waitForResponse(r =>
                r.url().includes(`/products/${productId}`) && r.status() !== 0,
                { timeout: 30000 }
            ).catch(() => null);
        } else {
            await logger.log(`[Naver] All strategies failed. Navigating directly with referer.`);
            await page.goto(directUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
                referer: `https://smartstore.naver.com/${storeName}/`
            });
        }
    }

    private async detectAndSolveCaptcha(page: Page, logger: Logger): Promise<void> {
        const isCaptcha = (await page.title()).includes('CAPTCHA');
        if (isCaptcha) {
            await logger.log('[Naver] CAPTCHA detected. Waiting for manual solve...');

            const captchaImageUrl = await this.safeEvaluate(page, () => {
                const imgById = document.querySelector('#captcha_img_cover') as HTMLImageElement;
                if (imgById) return imgById.src || imgById.getAttribute('src');

                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- browser context, XPathResult access
                const win = window as unknown as Record<string, unknown>;
                if (win.XPathResult) {
                    const xpath = '/html/body/div/div/div[2]/div/div/div/div[2]/div[1]/div/div[1]/img';
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return (result.singleNodeValue as HTMLImageElement)?.src || null;
                }
                return null;
            });
            if (captchaImageUrl) await logger.log(`[Naver] CAPTCHA URL: ${captchaImageUrl}`);

            await page.waitForSelector('h3._22_f_UC9_j, ._1_v1461f4, .product_detail', { timeout: 60000 }).catch(() => {
                logger.log('[Naver] Solve timeout or session ended.');
            });
        }
    }

    private parseUrl(url: string): { storeName: string; productId: string } {
        const match = url.match(/smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/);
        if (!match) throw new Error('Invalid Naver URL');
        return { storeName: match[1], productId: match[2] };
    }
}
