import { PrismaService } from 'src/prisma/prisma.service';
import { CartCustomerQueryService } from './cart-customer-query.service';
import { CartCheckoutService } from './cart-checkout.service';
import { CartGuestQueryService } from './cart-guest-query.service';

describe('CartCheckoutService', () => {
  it('selects customer cart persistence without exposing customer services to Order', async () => {
    const items = [{ id: 1 }];
    const customerQuery = {
      getCartItemsData: jest.fn().mockResolvedValue(items),
    } as unknown as CartCustomerQueryService;
    const guestQuery = {} as CartGuestQueryService;
    const service = new CartCheckoutService(customerQuery, guestQuery);
    const prisma = {} as PrismaService;

    const result = await service.getCartItemsData(prisma, 'Customer', [1]);

    expect(result).toBe(items);
    expect(customerQuery.getCartItemsData).toHaveBeenCalledWith(prisma, [1]);
  });
});
