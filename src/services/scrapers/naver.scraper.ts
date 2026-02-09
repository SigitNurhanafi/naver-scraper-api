// src/services/scrapers/naver.scraper.ts
import { BaseScraper } from './base.scraper';
import { Logger } from '../../utils/logger';
import { Page } from 'playwright';
import { delay, getRandomDelay } from '../../utils/delay';

export class NaverScraper extends BaseScraper {
    constructor() {
        super('naver');
    }

    async scrape(productUrl: string, logger: Logger) {
        const maxRetries = 3;
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const { storeName, productId } = this.parseUrl(productUrl);
            const context = await this.launchContext(logger);

            const responses: any = {
                benefits: null,
                productDetails: null
            };

            try {
                logger.log(`[Naver] Scrape attempt ${attempt}/${maxRetries}`);
                const page = await context.newPage();
                await this.setupPage(page);

                // 1. Setup Interceptor
                this.setupResponseInterceptor(page, responses, logger);

                // 2. Ninja Navigation
                await this.performNinjaNavigation(page, storeName, productId, productUrl, logger);

                // 3. CAPTCHA Check
                await this.detectAndSolveCaptcha(page, logger);

                if (page.isClosed()) throw new Error('Target closed');

                // 4. Stable Verification (Scroll + Early Exit)
                await this.scrollToBottom(page, logger);

                // 5. Data Validation & Return
                if (this.isValidData(responses.benefits) && this.isValidData(responses.productDetails)) {
                    logger.log(`[Naver] Attempt ${attempt} Success! All data captured.`);
                    await context.close().catch(() => { });
                    return { ...responses };
                } else {
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                    await this.waitForResponses(responses, logger, 10000);

                    if (this.isValidData(responses.benefits) && this.isValidData(responses.productDetails)) {
                        logger.log(`[Naver] Attempt ${attempt} Success! All data captured after wait.`);
                        await context.close().catch(() => { });
                        return { ...responses };
                    } else {
                        const missing = !this.isValidData(responses.benefits) ? 'benefits' : (!this.isValidData(responses.productDetails) ? 'productDetails' : 'unknown');
                        logger.log(`[Naver] Attempt ${attempt} failed: ${missing} missing/empty. Retrying... 🔄`);
                    }
                }

            } catch (error: any) {
                lastError = error;
                logger.error(`[Naver] Attempt ${attempt} crashed`, error);
            } finally {
                await context.close().catch(() => { });
                logger.log(`[Naver] Session ended for attempt ${attempt}`);
            }

            if (attempt < maxRetries) {
                await delay(2000); // Cool down before retry
            }
        }

        throw lastError || new Error('Naver scraper failed after max retries (Incomplete data)');
    }

    private setupResponseInterceptor(page: Page, responses: any, logger: Logger) {
        page.on('response', async (response) => {
            const url = response.url();
            const status = response.status();

            if (url.includes('smartstore.naver.com') && (url.includes('/api') || url.includes('/i/') || url.includes('/benefits/'))) {
                // Suppress noisy logs during retries unless error
                if (status >= 400) logger.log(`[Naver] Intercepted Error: [${status}] ${url}`);
            }

            try {
                if (page.isClosed()) return;
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    const data = await response.json().catch(() => null);
                    if (!data) return;

                    if (url.includes('/benefits/') || url.includes('/grade-benefits') || url.includes('/benefit-list')) {
                        responses.benefits = data;
                        logger.log(`[Naver] Captured benefits data (Status: ${status})`);
                    } else if (url.includes('/products/') && url.includes('/i/v2/') && url.includes('withWindow=false')) {
                        responses.productDetails = data;
                        logger.log(`[Naver] Captured productDetails data (Status: ${status})`);
                    }
                }
            } catch (e: any) { }
        });
    }

    private async performNinjaNavigation(page: Page, storeName: string, productId: string, directUrl: string, logger: Logger) {
        // Organic Navigation Flow: Store Home -> Product Detail
        const storeUrl = `https://smartstore.naver.com/${storeName}/`;
        logger.log(`[Naver] Navigating to Store: ${storeUrl}`);
        await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
        await delay(getRandomDelay(2000, 3000));

        // Integrated Browse-and-Find Flow
        logger.log(`[Naver] Browsing & Finding product link for ID: ${productId}`);
        let clicked = false;
        const productLinkSelector = `a[href*="/products/${productId}"]`;

        const maxScrolls = getRandomDelay(3, 5);
        for (let i = 0; i < maxScrolls; i++) {
            const productLink = await page.$(productLinkSelector);
            if (productLink && await productLink.isVisible()) {
                logger.log(`[Naver] Found link! Clicking...`);
                await productLink.scrollIntoViewIfNeeded();
                await delay(getRandomDelay(800, 1500));
                await productLink.click();
                clicked = true;
                break;
            }

            logger.log(`[Naver] Product not visible, scrolling... (${i + 1}/${maxScrolls})`);
            await page.mouse.wheel(0, getRandomDelay(400, 900));
            await delay(getRandomDelay(1000, 2000));

            if (Math.random() > 0.6) {
                await page.mouse.move(getRandomDelay(200, 600), getRandomDelay(200, 600), { steps: 5 });
            }
        }

        if (!clicked) {
            logger.log(`[Naver] Link not found during browse. Checking one last time at top...`);
            await page.evaluate(() => window.scrollTo(0, 0));
            await delay(1000);
            const finalCheck = await page.$(productLinkSelector).catch(() => null);
            if (finalCheck) {
                await finalCheck.click();
                clicked = true;
            }
        }

        // 🆕 Search fallback if still not found
        if (!clicked) {
            logger.log(`[Naver] Product not found on Home. Attempting Store Search for ID: ${productId} 🔍`);
            const searchUrl = `https://smartstore.naver.com/${storeName}/search?q=${productId}`;

            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
            await delay(getRandomDelay(2000, 3000));

            const searchLink = await page.$(productLinkSelector);
            if (searchLink) {
                logger.log(`[Naver] Found via Search! Clicking...`);
                await searchLink.scrollIntoViewIfNeeded();
                await delay(getRandomDelay(800, 1500));
                await searchLink.click();
                clicked = true;
            }
        }

        if (clicked) {
            // Wait for navigation after click
            await page.waitForResponse(r =>
                r.url().includes(`/products/${productId}`) && r.status() !== 0,
                { timeout: 30000 }
            ).catch(() => null);
        } else {
            logger.log(`[Naver] Link not found via Search. Navigating directly with referer.`);
            await page.goto(directUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
                referer: storeUrl
            });
        }
    }

    private async detectAndSolveCaptcha(page: Page, logger: Logger) {
        const isCaptcha = (await page.title()).includes('CAPTCHA');
        if (isCaptcha) {
            logger.log('[Naver] CAPTCHA detected. Waiting for manual solve...');

            const captchaImageUrl = await this.safeEvaluate(page, () => {
                const imgById = document.querySelector('#captcha_img_cover') as HTMLImageElement;
                if (imgById) return imgById.src || imgById.getAttribute('src');

                const win = window as any;
                if (win.XPathResult) {
                    const xpath = '/html/body/div/div/div[2]/div/div/div/div[2]/div[1]/div/div[1]/img';
                    const result = document.evaluate(xpath, document, null, win.XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return (result.singleNodeValue as HTMLImageElement)?.src || null;
                }
                return null;
            });
            if (captchaImageUrl) logger.log(`[Naver] CAPTCHA URL: ${captchaImageUrl}`);

            await page.waitForSelector('h3._22_f_UC9_j, ._1_v1461f4, .product_detail', { timeout: 60000 }).catch(() => {
                logger.log('[Naver] Solve timeout or session ended.');
            });
        }
    }

    private parseUrl(url: string) {
        const match = url.match(/smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/);
        if (!match) throw new Error('Invalid Naver URL');
        return { storeName: match[1], productId: match[2] };
    }
}
