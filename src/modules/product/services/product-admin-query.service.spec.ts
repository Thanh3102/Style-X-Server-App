import { PrismaService } from 'src/prisma/prisma.service';
import { ProductInventoryService } from './product-inventory.service';
import { ProductValidationService } from './product-validation.service';
import { ProductAdminQueryService } from './product-admin-query.service';
import { ProductVariantQueryService } from './product-variant-query.service';

describe('ProductAdminQueryService', () => {
  it('returns a paginated product list with the existing response shape', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
    const service = new ProductAdminQueryService(
      prisma,
      {} as ProductInventoryService,
      {} as ProductValidationService,
      {} as ProductVariantQueryService
    );

    const result = await service.get({ page: '1', limit: '20' });

    expect(result).toEqual({
      products: [],
      paginition: { total: 0, count: 0, page: 1, limit: 20 },
    });
  });
});
