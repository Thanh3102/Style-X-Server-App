import { MailService } from 'src/modules/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFulfillmentService } from './order-fulfillment.service';

describe('OrderFulfillmentService', () => {
  it('keeps delivery status and inventory updates in a transaction', async () => {
    const update = jest.fn().mockResolvedValue({
      code: 'ORDER-1',
      name: 'Buyer',
      email: 'buyer@example.com',
      province: 'P',
      district: 'D',
      ward: 'W',
      address: 'A',
      items: [],
    });
    const transactionClient = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ transactionStatus: 'paid' }),
        update,
      },
      inventory: { findFirst: jest.fn(), update: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new OrderFulfillmentService(prisma, {} as MailService);

    await service.confirmDelivery('order-1', false, 7);

    expect(update).toHaveBeenCalled();
  });
});
