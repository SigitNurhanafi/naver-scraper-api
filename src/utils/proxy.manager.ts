// src/utils/proxy.manager.ts
import NodeCache from 'node-cache';
import { ProxyConfig } from '../types';
import { getProxyList, isProxyWorking } from './proxy.validator';
import { Logger } from './logger';

export class ProxyManager {
    private static instance: ProxyManager;
    private badProxyCache: NodeCache;
    private lastUsedIndex: number = -1;

    private constructor() {
        // Cache for bad proxies with 5 minutes TTL
        this.badProxyCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    }

    public static getInstance(): ProxyManager {
        if (!ProxyManager.instance) {
            ProxyManager.instance = new ProxyManager();
        }
        return ProxyManager.instance;
    }

    /**
     * Get the next healthy proxy from the list.
     * Rotates through available proxies and skips those flagged as bad.
     */
    public async getNextProxy(logger: Logger): Promise<ProxyConfig | null> {
        const proxyList = getProxyList();
        if (proxyList.length === 0) return null;

        const totalProxies = proxyList.length;

        // Try to find the next healthy proxy starting from the last used index
        for (let i = 0; i < totalProxies; i++) {
            this.lastUsedIndex = (this.lastUsedIndex + 1) % totalProxies;
            const proxy = proxyList[this.lastUsedIndex];

            if (this.isBad(proxy)) {
                continue;
            }

            // Optional: Double check if it's REALLY working before returning
            const working = await isProxyWorking(logger, proxy);
            if (working) {
                return proxy;
            } else {
                this.markBad(proxy, 'Connectivity failure during selection');
            }
        }

        return null;
    }

    /**
     * Marks a proxy as "bad" so it won't be picked for a while.
     */
    public markBad(proxy: ProxyConfig, reason: string): void {
        const key = this.getProxyKey(proxy);
        this.badProxyCache.set(key, { reason, timestamp: Date.now() });
    }

    private isBad(proxy: ProxyConfig): boolean {
        const key = this.getProxyKey(proxy);
        return this.badProxyCache.has(key);
    }

    private getProxyKey(proxy: ProxyConfig): string {
        return `${proxy.server}-${proxy.username || ''}`;
    }
}

export const proxyManager = ProxyManager.getInstance();
