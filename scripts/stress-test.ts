import axios from 'axios';
import pQueue from 'p-queue';
import { Logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';

async function runStressTest() {
    const logger = new Logger('StressTest');
    const queue = new pQueue({ concurrency: 5 });
    const baseUrl = 'http://localhost:3000/naver';

    // 1. Load URLs from file
    const urlsPath = path.join(process.cwd(), 'scripts', 'urls.txt');
    let testUrls: string[] = [];

    if (fs.existsSync(urlsPath)) {
        testUrls = fs.readFileSync(urlsPath, 'utf-8')
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);
        logger.log(`📂 Loaded ${testUrls.length} unique URLs from urls.txt`);
    } else {
        // Fallback sample URLs if file doesn't exist
        testUrls = [
            'https://smartstore.naver.com/thefactor2/products/12570192302',
            'https://smartstore.naver.com/yeon_a_cosmetic/products/11247781492'
        ];
        logger.log('⚠️ urls.txt not found. Using fallback sample URLs.');
    }

    // 2. Prepare responses directory
    const responsesDir = path.join(process.cwd(), 'logs', 'responses');
    if (!fs.existsSync(responsesDir)) {
        fs.mkdirSync(responsesDir, { recursive: true });
    }

    const totalRequests = testUrls.length;
    let success = 0;
    let failure = 0;
    const start = Date.now();

    logger.log(`🚀 Starting Stress Test: ${totalRequests} items with concurrency 5`);

    const tasks = testUrls.map((url, i) => async () => {
        const requestId = i + 1;
        const taskStart = Date.now();
        try {
            logger.log(`[#${requestId}] Testing: ${url}`);
            const response = await axios.get(baseUrl, {
                params: { productUrl: url },
                timeout: 120000
            });

            const duration = (Date.now() - taskStart) / 1000;
            if (response.data.success) {
                success++;
                // Save full response to file
                const responsePath = path.join(responsesDir, `response-${requestId}.json`);
                fs.writeSync(fs.openSync(responsePath, 'w'), JSON.stringify(response.data, null, 2));

                logger.log(`[#${requestId}] SUCCESS in ${duration.toFixed(2)}s (Saved to ${path.basename(responsePath)}) ✅`);
            } else {
                failure++;
                logger.log(`[#${requestId}] FAILED (API error): ${JSON.stringify(response.data.error || 'Unknown')} ❌`);
            }
        } catch (error: any) {
            failure++;
            logger.error(`[#${requestId}] CRASHED: ${error.message} 💀`, error);
        }
    });

    await queue.addAll(tasks);

    const totalDuration = (Date.now() - start) / 1000;
    const avgLatency = success > 0 ? (totalDuration / success).toFixed(2) : '0';

    logger.log('\n--- STRESS TEST FINAL RESULT ---');
    logger.log(`Items Processed: ${totalRequests}`);
    logger.log(`Success: ${success} ✅`);
    logger.log(`Failure: ${failure} ❌`);
    logger.log(`Total Duration: ${totalDuration.toFixed(2)}s`);
    logger.log(`Avg Speed: ${avgLatency}s/item`);
    logger.log('--------------------------------');
}

runStressTest().catch(console.error);
