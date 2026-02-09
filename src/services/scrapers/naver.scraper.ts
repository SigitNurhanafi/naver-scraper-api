// src/services/scrapers/naver.scraper.ts
import { BaseScraper } from './base.scraper';
import { Logger } from '../../utils/logger';
import { delay, getRandomDelay } from '../../utils/delay';

export class NaverScraper extends BaseScraper {
    constructor() {
        super('naver');
    }

    async scrape(productUrl: string, logger: Logger) {
        const { storeName, productId } = this.parseUrl(productUrl);
        const context = await this.launchContext(logger);

        const responses: any = {
            benefits: null,
            productDetails: null
        };

        try {
            const page = await context.newPage();
            await this.setupPage(page);

            page.on('response', async (response) => {
                const url = response.url();
                const status = response.status();

                if (url.includes('smartstore.naver.com') && (url.includes('/api') || url.includes('/i/') || url.includes('/benefits/'))) {
                    logger.log(`[Naver] Intercepted: [${status}] ${url}`);
                }

                try {
                    if (page.isClosed()) return;
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        const data = await response.json().catch(() => null);
                        if (!data) return;

                        if (url.includes('/benefits/by-product')) {
                            responses.benefits = data;
                            logger.log(`[Naver] Captured benefits data`);
                        } else if (url.includes('/i/v2/channels/') && url.includes('/products/')) {
                            responses.productDetails = data;
                            logger.log(`[Naver] Captured productDetails data`);
                        }
                    }
                } catch (e: any) { }
            });

            // Organic Navigation Flow: Store Home -> Product Detail
            const storeUrl = `https://smartstore.naver.com/${storeName}/`;
            logger.log(`[Naver] Step 1: Navigating to Store Home: ${storeUrl}`);
            await page.goto(storeUrl, { waitUntil: 'domcontentloaded' });
            await delay(getRandomDelay(2000, 3000));

            // Integrated Browse-and-Find Flow
            logger.log(`[Naver] Step 2: Browsing & Finding product link for ID: ${productId}`);
            let clicked = false;
            const productLinkSelector = `a[href*="/products/${productId}"]`;

            const maxScrolls = getRandomDelay(3, 5);
            for (let i = 0; i < maxScrolls; i++) {
                const productLink = await page.$(productLinkSelector);
                if (productLink && await productLink.isVisible()) {
                    logger.log(`[Naver] Target link found! Clicking naturally...`);
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

            let navigationResponse;
            if (clicked) {
                // Wait for navigation after click
                navigationResponse = await page.waitForResponse(r =>
                    r.url().includes(`/products/${productId}`) && r.status() !== 0,
                    { timeout: 30000 }
                ).catch(() => null);
            } else {
                logger.log(`[Naver] Link not found on current view. Navigating directly with referer.`);
                navigationResponse = await page.goto(productUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000,
                    referer: storeUrl
                });
            }

            const isCaptcha = navigationResponse?.status() === 490 || (await page.title()).includes('CAPTCHA');
            if (isCaptcha) {
                logger.log('[Naver] CAPTCHA detected. Waiting for manual solve...');

                const captchaImageUrl = await this.safeEvaluate(page, () => {
                    const imgById = document.querySelector('#captcha_img_cover') as HTMLImageElement;
                    if (imgById) return imgById.src || imgById.getAttribute('src');
                    const xpath = '/html/body/div/div/div[2]/div/div/div/div[2]/div[1]/div/div[1]/img';
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    return (result.singleNodeValue as HTMLImageElement)?.src || null;
                });
                if (captchaImageUrl) logger.log(`[Naver] CAPTCHA URL: ${captchaImageUrl}`);

                await page.waitForSelector('h3._22_f_UC9_j, ._1_v1461f4, .product_detail', { timeout: 60000 }).catch(() => {
                    logger.log('[Naver] Solve timeout or session ended.');
                });
            }

            if (page.isClosed()) throw new Error('Target closed');

            // 3. Stable Verification (Scroll + Early Exit)
            await this.scrollToBottom(page, logger);

            // Early Exit Optimization: Check if we already have the JSONs
            if (responses.benefits && responses.productDetails) {
                logger.log('[Naver] Early-exit: Required data captured after scroll');
            } else {
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                await this.waitForResponses(responses, logger, 10000);
            }

            return { ...responses };

        } catch (error: any) {
            logger.error(`[Naver] Scraping process failed`, error);
            if (responses.benefits || responses.productDetails) {
                return responses;
            }
            throw error;
        } finally {
            await context.close().catch(() => { });
            logger.log(`[Naver] Session ended`);
        }
    }

    private parseUrl(url: string) {
        const match = url.match(/smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/);
        if (!match) throw new Error('Invalid Naver URL');
        return { storeName: match[1], productId: match[2] };
    }
}
