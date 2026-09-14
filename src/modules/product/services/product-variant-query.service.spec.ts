import { PrismaService } from 'src/prisma/prisma.service';
import { DiscountService } from '../../discount/discount.service';
import { InventoriesService } from '../../inventories/inventories.service';
import { ProductVariantQueryService } from './product-variant-query.service';

describe('ProductVariantQueryService', () => {
  it('returns product options with values flattened in short mode', async () => {
    const prisma = {
      productProperties: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            name: 'Color',
            position: 1,
            values: [{ value: 'Black' }, { value: 'White' }],
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new ProductVariantQueryService(
      prisma,
      {} as InventoriesService,
      {} as DiscountService
    );

    const result = await service.getProductOptions(10, true);

    expect(result).toEqual([
      { id: 1, name: 'Color', values: ['Black', 'White'] },
    ]);
  });

  it('returns variant ids for product categories', async () => {
    const prisma = {
      productVariants: {
        findMany: jest.fn().mockResolvedValue([{ id: 11 }, { id: 12 }]),
      },
    } as unknown as PrismaService;
    const service = new ProductVariantQueryService(
      prisma,
      {} as InventoriesService,
      {} as DiscountService
    );

    const result = await service.findVariantIdByCategoryId([3]);

    expect(result).toEqual([11, 12]);
  });
});
