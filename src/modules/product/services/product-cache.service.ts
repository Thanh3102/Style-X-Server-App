import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export const PUBLIC_PRODUCT_CACHE_TTL = 60 * 60 * 1000;

export function publicProductCacheKey(page: number, limit: number): string {
  return `products-page-${page}-${limit}`;
}

@Injectable()
export class ProductCacheService {
  private readonly publicProductKeys = new Set<string>();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getPublicProductPage<T>(
    page: number,
    limit: number
  ): Promise<T | undefined> {
    const key = publicProductCacheKey(page, limit);
    this.publicProductKeys.add(key);

    const cachedData = await this.cacheManager.get<string | T>(key);
    if (typeof cachedData !== 'string') return cachedData;

    return JSON.parse(cachedData) as T;
  }

  async setPublicProductPage<T>(
    page: number,
    limit: number,
    data: T
  ): Promise<void> {
    const key = publicProductCacheKey(page, limit);
    this.publicProductKeys.add(key);
    await this.cacheManager.set(
      key,
      JSON.stringify(data),
      PUBLIC_PRODUCT_CACHE_TTL
    );
  }

  async invalidatePublicProductPages(): Promise<void> {
    const keys = new Set(this.publicProductKeys);

    for (const store of this.cacheManager.stores ?? []) {
      if (!store.iterator) continue;
      for await (const entry of store.iterator(undefined)) {
        const key = entry[0];
        if (typeof key === 'string' && key.startsWith('products-page-')) {
          keys.add(key);
        }
      }
    }

    await Promise.all([...keys].map((key) => this.cacheManager.del(key)));
    this.publicProductKeys.clear();
  }
}
