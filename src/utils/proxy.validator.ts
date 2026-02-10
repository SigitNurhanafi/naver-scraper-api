// src/utils/proxy.validator.ts
import axios from 'axios';
import { config } from '../config/config';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Logger } from './logger';
import { ProxyConfig } from '../types';

export async function isProxyWorking(logger: Logger, proxyConfig?: ProxyConfig): Promise<boolean> {
    const proxyUrl = proxyConfig?.server || config.proxy.url;
    const username = proxyConfig?.username || config.proxy.username;
    const password = proxyConfig?.password || config.proxy.password;

    if (!proxyUrl) return false;

    try {
        const auth = username && password ? `${username}:${password}@` : '';
        const cleanUrl = proxyUrl.replace(/^https?:\/\//, '');
        const proxyFullUrl = `http://${auth}${cleanUrl}`;

        await logger.log(`[ProxyCheck] Validating: ${proxyUrl.split('@').pop()}`);

        const agent = new HttpsProxyAgent(proxyFullUrl);

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
    const urls = (config.proxy.url || '').split(',').filter(Boolean);
    const users = (config.proxy.username || '').split(',');
    const passes = (config.proxy.password || '').split(',');

    return urls.map((url, i) => ({
        server: url.trim(),
        username: users[i]?.trim(),
        password: passes[i]?.trim()
    }));
}
