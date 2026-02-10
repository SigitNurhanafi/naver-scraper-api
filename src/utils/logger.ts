// src/utils/logger.ts
import { appendFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { ErrorDetails } from '../types';

const LOGS_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists (one-time sync check at module load)
if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
}

export class Logger {
    private readonly requestId: string;
    private readonly logFile: string;

    constructor(requestId: string) {
        this.requestId = requestId;
        this.logFile = path.join(LOGS_DIR, `request-${requestId}.log`);
    }

    async log(message: string, data?: unknown): Promise<void> {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) + '\n' : ''}`;
        await appendFile(this.logFile, logEntry).catch(() => { });
        console.log(`[${this.requestId}] ${message}`);
    }

    async error(message: string, error: unknown): Promise<void> {
        const timestamp = new Date().toISOString();
        const details: ErrorDetails = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            code: (error as Record<string, unknown>)?.code as string | undefined,
            status: (error as Record<string, unknown>)?.response
                ? ((error as Record<string, unknown>).response as Record<string, unknown>)?.status as number | undefined
                : undefined,
            data: (error as Record<string, unknown>)?.response
                ? ((error as Record<string, unknown>).response as Record<string, unknown>)?.data
                : undefined
        };
        const logEntry = `[${timestamp}] ERROR: ${message}\n${JSON.stringify(details, null, 2)}\n`;
        await appendFile(this.logFile, logEntry).catch(() => { });
        console.error(`[${this.requestId}] ERROR: ${message}`, details.message);
    }
}
