import { PrismaService } from 'src/prisma/prisma.service';
import { CartCustomerQueryService } from './cart-customer-query.service';
import { CartGuestCommandService } from './cart-guest-command.service';
import { CartGuestQueryService } from './cart-guest-query.service';
import { CartSyncService } from './cart-sync.service';

describe('CartSyncService', () => {
  it('returns success without mutating when the guest cart is missing', async () => {
    const customerQuery = {
      findUserCartById: jest.fn().mockResolvedValue(null),
    } as unknown as CartCustomerQueryService;
    const guestQuery = {
      findGuestCartById: jest.fn().mockResolvedValue(null),
    } as unknown as CartGuestQueryService;
    const service = new CartSyncService(
      {} as PrismaService,
      customerQuery,
      guestQuery,
      {} as CartGuestCommandService
    );

    await expect(service.syncCart('customer-1', null)).resolves.toEqual({
      success: true,
    });
  });
});
