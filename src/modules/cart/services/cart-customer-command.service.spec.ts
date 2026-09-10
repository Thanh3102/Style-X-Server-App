import { PrismaService } from 'src/prisma/prisma.service';
import { CartCustomerCommandService } from './cart-customer-command.service';
import { CartStockPolicy } from './cart-stock-policy.service';

describe('CartCustomerCommandService', () => {
  it('selects only the requested customer cart items', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValue({ id: 5 });
    const prisma = {
      cart: { findUnique },
      cartItem: { updateMany },
    } as unknown as PrismaService;
    const service = new CartCustomerCommandService(
      prisma,
      {} as CartStockPolicy
    );

    const result = await service.updateSelectedItems('customer-1', [2, 3]);

    expect(result).toEqual({ status: 200, body: {} });
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { cartId: 5, id: { in: [2, 3] } },
      data: { selected: true },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { cartId: 5, id: { notIn: [2, 3] } },
      data: { selected: false },
    });
  });
});
