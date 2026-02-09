import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Logger } from './logger';

export interface ProxyConfig {
    server: string;
    username?: string;
    password?: string;
}

export async function isProxyWorking(logger: Logger, config?: ProxyConfig): Promise<boolean> {
    const proxyUrl = config?.server || process.env.PROXY_URL;
    const username = config?.username || process.env.PROXY_USERNAME;
    const password = config?.password || process.env.PROXY_PASSWORD;

    if (!proxyUrl) return false;

    try {
        const displayUrl = proxyUrl.split('@').pop() || proxyUrl;
        logger.log(`[ProxyCheck] Validating proxy: ${displayUrl}...`);

        const auth = username && password ? `${username}:${password}@` : '';
        const cleanProxyUrl = proxyUrl.replace('http://', '').replace('https://', '');
        const proxyFullUrl = `http://${auth}${cleanProxyUrl}`;

        const agent = new HttpsProxyAgent(proxyFullUrl);

        const response = await axios.get('https://www.naver.com', {
            httpsAgent: agent,
            proxy: false,
            timeout: 5000
        });

        if (response.status === 200) {
            logger.log(`[ProxyCheck] Proxy is healthy! ✅`);
            return true;
        }
        return false;
    } catch (error: any) {
        logger.log(`[ProxyCheck] Proxy failed: ${error.message} ❌`);
        return false;
    }
}

export function getProxyList(): ProxyConfig[] {
    const urls = (process.env.PROXY_URL || '').split(',').filter(Boolean);
    const users = (process.env.PROXY_USERNAME || '').split(',');
    const passes = (process.env.PROXY_PASSWORD || '').split(',');

    return urls.map((url, i) => ({
        server: url.trim(),
        username: users[i]?.trim(),
        password: passes[i]?.trim()
    }));
}
