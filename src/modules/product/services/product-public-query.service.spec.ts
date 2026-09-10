import { PrismaService } from 'src/prisma/prisma.service';
import { ProductCacheService } from './product-cache.service';
import { ProductPublicQueryService } from './product-public-query.service';
import { ProductValidationService } from './product-validation.service';
import { ProductVariantQueryService } from './product-variant-query.service';

describe('ProductPublicQueryService', () => {
  it('returns the cached public page without querying products', async () => {
    const cachedPage = {
      data: [],
      total: 0,
      limit: 20,
      currentPage: 1,
      lastPage: 0,
    };
    const cacheService = {
      getPublicProductPage: jest.fn().mockResolvedValue(cachedPage),
    } as unknown as ProductCacheService;
    const prisma = {
      product: { findMany: jest.fn(), count: jest.fn() },
    } as unknown as PrismaService;
    const service = new ProductPublicQueryService(
      prisma,
      {} as ProductVariantQueryService,
      {} as ProductValidationService,
      cacheService
    );

    const result = await service.fetchProductPublic({});

    expect(result).toBe(cachedPage);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('keeps collection and category filters when both are provided', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const cacheService = {
      getPublicProductPage: jest.fn().mockResolvedValue(undefined),
      setPublicProductPage: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProductCacheService;
    const prisma = {
      product: { findMany, count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new ProductPublicQueryService(
      prisma,
      {} as ProductVariantQueryService,
      {} as ProductValidationService,
      cacheService
    );

    await service.fetchProductPublic({ slug: 'summer', category: 'shoes' });

    expect(findMany.mock.calls[0][0].where).toEqual({
      avaiable: true,
      void: false,
      productCategories: {
        some: {
          category: {
            collection: { slug: 'summer' },
            slug: 'shoes',
          },
        },
      },
    });
  });
});
