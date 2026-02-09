// src/services/scraper.service.ts
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomFingerprint } from '../utils/fingerprint';
import { delay, getRandomDelay } from '../utils/delay';
import { Logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

// Use stealth plugin
chromium.use(StealthPlugin());

const USER_DATA_DIR = path.join(process.cwd(), 'user_data');

if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR);
}

export class ScraperService {
  async scrapeProduct(productUrl: string, logger: Logger) {
    const { storeName, productId } = this.parseUrl(productUrl);
    logger.log(`Starting ORGANIC stealth scrape for ${productUrl}`, { storeName, productId });

    const fingerprint = getRandomFingerprint();
    logger.log('Using advanced fingerprint', fingerprint);

    // Launch with Persistent Context (Harder to detect, persists cookies/session)
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
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
    });

    const responses: any = {
      benefits: null,
      productDetails: null,
      allJson: {}
    };

    try {
      const page = await context.newPage();

      // Forcefully remove webdriver flag (Point 2 refinement)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // @ts-ignore
        window.chrome = { runtime: {} };
      });

      page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();

        if (url.includes('smartstore.naver.com') && (url.includes('/api') || url.includes('/i/') || url.includes('/benefits/'))) {
          logger.log(`Intercepted: [${status}] ${url}`);
        }

        try {
          if (page.isClosed()) return;
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json().catch(() => null);
            if (!data) return;

            if (url.includes('/benefits/by-product')) {
              responses.benefits = data;
              logger.log(`Captured benefits data`);
            } else if (url.includes('/i/v2/channels/') && url.includes('/products/')) {
              responses.productDetails = data;
              logger.log(`Captured productDetails data`);
            } else {
              const key = url.split('/').pop()?.split('?')[0] || `api_${Date.now()}`;
              responses.allJson[key] = data;
            }
          }
        } catch (e: any) { }
      });

      // ORGANIC NAVIGATION FLOW: Naver Search -> Product
      logger.log(`Step 1: Performing Organic Search for store: ${storeName}`);
      await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(storeName)}`, { waitUntil: 'domcontentloaded' });
      await delay(getRandomDelay(2000, 4000));
      await this.simulateHumanBehavior(page);

      logger.log(`Step 2: Navigating to target product via search referer...`);
      const navigationResponse = await page.goto(productUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
        referer: `https://search.naver.com/search.naver?query=${encodeURIComponent(storeName)}`
      });

      // CAPTCHA Detection
      const isCaptcha = navigationResponse?.status() === 490 || (await page.title()).includes('CAPTCHA');
      if (isCaptcha) {
        logger.log('CAPTCHA page detected. Checking if image loads...');
        await delay(3000);

        if (page.isClosed()) throw new Error('Target closed during CAPTCHA load');

        // Capture CAPTCHA Image URL
        const captchaImageUrl = await this.safeEvaluate(page, () => {
          const imgById = document.querySelector('#captcha_img_cover') as HTMLImageElement;
          if (imgById) return imgById.src || imgById.getAttribute('src');
          const xpath = '/html/body/div/div/div[2]/div/div/div/div[2]/div[1]/div/div[1]/img';
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          const imgByXpath = result.singleNodeValue as HTMLImageElement;
          return imgByXpath ? imgByXpath.src || imgByXpath.getAttribute('src') : null;
        });
        if (captchaImageUrl) logger.log(`CAPTCHA Image Asset Found: ${captchaImageUrl}`);

        const hasError = await this.safeEvaluate(page, () => document.body.innerText.includes('에러가 발생했습니다'));
        if (hasError) {
          logger.log('CAPTCHA Image failed to load. Refreshing page...');
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
          await delay(2000);
        }

        logger.log('Waiting for manual solve (60s)... or until product title found');
        await page.waitForSelector('h3._22_f_UC9_j, ._1_v1461f4, .product_detail', { timeout: 60000 }).catch(() => {
          logger.log('Manual solve session ended or timeout reached.');
        });
      }

      if (page.isClosed()) throw new Error('Target closed after CAPTCHA solve');

      const metadata = await this.safeEvaluate(page, () => {
        const stateScript = Array.from(document.querySelectorAll('script')).find(s => s.textContent?.includes('__INITIAL_STATE__'));
        return stateScript ? stateScript.textContent : null;
      });
      if (metadata) logger.log('Found __INITIAL_STATE__ in HTML');

      logger.log('Simulating finishing touches...');
      await this.simulateHumanBehavior(page);

      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });

      logger.log(`Finalizing data capture...`);
      await this.waitForResponses(responses, logger);

      return {
        ...responses,
        htmlMetadataPresent: !!metadata
      };
    } catch (error: any) {
      if (error.message.includes('Target closed') || error.message.includes('Context closed') || error.message.includes('detached')) {
        logger.log('Scraper aborted: Browser was closed or navigation interrupted.');
      } else {
        logger.error('Scraping error', error);
      }
      if (responses && (responses.benefits || responses.productDetails || (responses.allJson && Object.keys(responses.allJson).length > 0))) {
        logger.log('Returning partially captured data despite error.');
        return responses;
      }
      throw error;
    } finally {
      try {
        await context.close();
        logger.log('Session ended.');
      } catch (e) { }
    }
  }

  private async safeEvaluate(page: any, fn: () => any) {
    try {
      if (page.isClosed()) return null;
      return await page.evaluate(fn);
    } catch (e) {
      return null;
    }
  }

  private async simulateHumanBehavior(page: any) {
    try {
      if (page.isClosed()) return;
      for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, getRandomDelay(200, 500));
        await delay(getRandomDelay(400, 800));
      }
      await page.mouse.move(getRandomDelay(200, 600), getRandomDelay(200, 600));
    } catch (e) { }
  }

  private parseUrl(url: string) {
    const match = url.match(/smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/);
    if (!match) throw new Error('Invalid Naver URL format');
    return {
      storeName: match[1],
      productId: match[2]
    };
  }

  private async waitForResponses(responses: any, logger: Logger, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (responses.benefits || responses.productDetails || (responses.allJson && Object.keys(responses.allJson).length > 0)) {
        logger.log('Some target responses captured');
        return;
      }
      await delay(1000);
    }
    logger.log('Timeout waiting for any JSON response');
  }
}

export const scraperService = new ScraperService();