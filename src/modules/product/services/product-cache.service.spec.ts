import { Cache } from 'cache-manager';
import { ProductCacheService } from './product-cache.service';

describe('ProductCacheService', () => {
  it('invalidates public product pages that were read or written', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(true),
    } as unknown as Cache;
    const service = new ProductCacheService(cache);

    await service.getPublicProductPage(1, 20);
    await service.setPublicProductPage(1, 20, { data: [] });
    await service.invalidatePublicProductPages();

    expect(cache.del).toHaveBeenCalledWith('products-page-1-20');
  });
});
