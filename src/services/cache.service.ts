import NodeCache = require('node-cache');
import { config } from '../config/config';

export class CacheService {
  private static instance: CacheService;
  private readonly cache: NodeCache;

  private constructor() {
    this.cache = new NodeCache({ stdTTL: config.scraper.resultCacheTTL, checkperiod: 120 });
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  public set<T>(key: string, value: T, ttl?: number): boolean {
    if (ttl) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  public del(key: string): number {
    return this.cache.del(key);
  }

  public flush(): void {
    this.cache.flushAll();
  }
}

export const cacheService = CacheService.getInstance();