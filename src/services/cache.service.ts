import NodeCache = require('node-cache');

export class CacheService {
  private static instance: CacheService;
  private cache: NodeCache;

  private constructor() {
    // Default TTL 10 seconds as requested by user
    this.cache = new NodeCache({ stdTTL: 10, checkperiod: 120 });
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

  public set(key: string, value: any, ttl?: number): boolean {
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