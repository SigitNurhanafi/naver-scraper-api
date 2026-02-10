// src/utils/proxy.validator.ts
import axios from 'axios';
import { config } from '../config/config';
import fs from 'fs';
import path from 'path';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Logger } from './logger';
import { ProxyConfig } from '../types';

export async function isProxyWorking(logger: Logger, proxyConfig?: ProxyConfig): Promise<boolean> {
    const proxyUrl = proxyConfig?.server;
    const username = proxyConfig?.username;
    const password = proxyConfig?.password;

    if (!proxyUrl) return false;

    try {
        const auth = username && password ? `${username}:${password}@` : '';
        const protocol = proxyUrl.startsWith('socks') ? 'socks' : 'http';
        const cleanUrl = proxyUrl.replace(/^(https?|socks[45]?):\/\//, '');

        // Construct standard URL for agent
        const proxyFullUrl = `${protocol}://${auth}${cleanUrl}`;

        await logger.log(`[ProxyCheck] Validating: ${proxyUrl.split('@').pop()} (${protocol.toUpperCase()})`);

        const agent = protocol === 'socks'
            ? new SocksProxyAgent(proxyFullUrl)
            : new HttpsProxyAgent(proxyFullUrl);

        const response = await axios.get(config.naver.baseUrl, {
            httpsAgent: agent,
            proxy: false,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            validateStatus: () => true
        });

        if (response.status === 200) {
            await logger.log(`[ProxyCheck] Proxy is healthy! ✅`);
            return true;
        } else {
            await logger.log(`[ProxyCheck] Proxy reached target but got status ${response.status} ⚠️`);
            return false;
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await logger.log(`[ProxyCheck] Proxy failed: ${message} ❌`);
        return false;
    }
}

export function getProxyList(): ProxyConfig[] {
    try {
        const proxyPath = path.join(process.cwd(), 'proxies.json');
        if (!fs.existsSync(proxyPath)) return [];

        const fileContent = fs.readFileSync(proxyPath, 'utf-8');
        return JSON.parse(fileContent) as ProxyConfig[];
    } catch (error) {
        console.error('Failed to load proxies.json:', error);
        return [];
    }
}
