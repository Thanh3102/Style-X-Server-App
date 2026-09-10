import { PrismaService } from 'src/prisma/prisma.service';
import { CartGuestCommandService } from './cart-guest-command.service';
import { CartStockPolicy } from './cart-stock-policy.service';

describe('CartGuestCommandService', () => {
  it('creates an expiring guest cart with an optional first item', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'guest-1' });
    const prisma = {
      guestCart: { create },
    } as unknown as PrismaService;
    const service = new CartGuestCommandService(prisma, {} as CartStockPolicy);

    const result = await service.createGuestCart({
      productId: 1,
      variantId: 2,
      quantity: 3,
    });

    expect(result).toEqual({ id: 'guest-1' });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        items: {
          create: { productId: 1, variantId: 2, quantity: 3 },
        },
      }),
    });
  });
});
