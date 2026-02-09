// src/utils/logger.ts
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR);
}

export class Logger {
    private requestId: string;
    private logFile: string;

    constructor(requestId: string) {
        this.requestId = requestId;
        this.logFile = path.join(LOGS_DIR, `request-${requestId}.log`);
    }

    log(message: string, data?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) + '\n' : ''}`;
        fs.appendFileSync(this.logFile, logEntry);
        console.log(`[${this.requestId}] ${message}`);
    }

    error(message: string, error: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ERROR: ${message}\n${JSON.stringify({
            message: error.message,
            stack: error.stack,
            ...error
        }, null, 2)}\n`;
        fs.appendFileSync(this.logFile, logEntry);
        console.error(`[${this.requestId}] ERROR: ${message}`, error.message);
    }
}
