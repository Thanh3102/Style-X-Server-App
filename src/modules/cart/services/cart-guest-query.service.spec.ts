import { PrismaService } from 'src/prisma/prisma.service';
import { ProductQueryService } from '../../product/services/product-query.service';
import { CartGuestQueryService } from './cart-guest-query.service';
import { CartStockPolicy } from './cart-stock-policy.service';

describe('CartGuestQueryService', () => {
  it('returns guest cart items from the provided cart id', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      guestCartItem: { findMany },
    } as unknown as PrismaService;
    const service = new CartGuestQueryService(
      prisma,
      {} as ProductQueryService,
      {} as CartStockPolicy
    );

    const result = await service.findGuestCartItems('guest-cart');

    expect(result).toEqual([]);
    expect(findMany).toHaveBeenCalled();
  });
});
