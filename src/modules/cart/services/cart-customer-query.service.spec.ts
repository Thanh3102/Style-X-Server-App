import { PrismaService } from 'src/prisma/prisma.service';
import { ProductQueryService } from '../../product/services/product-query.service';
import { CartCustomerQueryService } from './cart-customer-query.service';
import { CartStockPolicy } from './cart-stock-policy.service';

describe('CartCustomerQueryService', () => {
  it('returns customer cart items from the provided cart id', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      cartItem: { findMany },
    } as unknown as PrismaService;
    const service = new CartCustomerQueryService(
      prisma,
      {} as ProductQueryService,
      {} as CartStockPolicy
    );

    const result = await service.findCartItems(20);

    expect(result).toEqual([]);
    expect(findMany).toHaveBeenCalled();
  });
});
