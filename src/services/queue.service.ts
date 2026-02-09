import PQueue from 'p-queue';
import dotenv from 'dotenv';

dotenv.config();

const maxConcurrency = parseInt(process.env.MAX_CONCURRENT || '5', 10);

export const globalQueue = new PQueue({ concurrency: maxConcurrency });

console.log(`[Queue] Initialized with concurrency: ${maxConcurrency}`);