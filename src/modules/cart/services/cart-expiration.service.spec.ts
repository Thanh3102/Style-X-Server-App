import { PrismaService } from 'src/prisma/prisma.service';
import { CartExpirationService } from './cart-expiration.service';

describe('CartExpirationService', () => {
  it('removes expired guest items and carts in one transaction', async () => {
    const deleteGuestItems = jest.fn().mockResolvedValue({ count: 1 });
    const deleteGuestCarts = jest.fn().mockResolvedValue({ count: 1 });
    const transactionClient = {
      guestCartItem: { deleteMany: deleteGuestItems },
      guestCart: { deleteMany: deleteGuestCarts },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new CartExpirationService(prisma);

    await service.deleteExpireGuestCart();

    expect(deleteGuestItems).toHaveBeenCalled();
    expect(deleteGuestCarts).toHaveBeenCalled();
  });
});
