import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiscountDTO } from '../discount.type';
import { DiscountCommandService } from './discount-command.service';

describe('DiscountCommandService', () => {
  it('creates a discount through the transaction client', async () => {
    const transactionClient = {
      discount: {
        create: jest.fn().mockResolvedValue({ id: 8 }),
      },
      discountCategory: { createMany: jest.fn() },
      discountProduct: { createMany: jest.fn() },
      discountVariant: { createMany: jest.fn() },
      product: { findMany: jest.fn() },
    };
    const prisma = {
      discount: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
        callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new DiscountCommandService(prisma);
    const dto: CreateDiscountDTO = {
      type: 'product',
      mode: 'promotion',
      title: 'Summer',
      description: 'Summer sale',
      value: 10,
      valueLimitAmount: null,
      valueType: 'percent',
      entitle: 'all',
      prerequisite: 'none',
      prerequisiteCustomerGroupIds: [],
      prerequisiteMinTotal: null,
      prerequisiteMinItem: null,
      prerequisiteMinItemTotal: null,
      usageLimit: null,
      onePerCustomer: false,
      combinesWithProductDiscount: false,
      combinesWithOrderDiscount: false,
      startOn: new Date('2026-01-01T00:00:00.000Z'),
      endOn: null,
      active: true,
      summary: 'Summer sale',
      entitledProductIds: [],
      entitledVariantIds: [],
      entitledCategoriesIds: [],
      applyFor: 'all',
    };

    const result = await service.create(dto, 3);

    expect(result).toEqual({ id: 8 });
    expect(transactionClient.discount.create).toHaveBeenCalledTimes(1);
    expect(prisma.discount.create).not.toHaveBeenCalled();
  });
});
