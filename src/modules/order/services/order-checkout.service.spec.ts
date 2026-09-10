import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/modules/mail/mail.service';
import { OrderCheckoutService } from './order-checkout.service';

describe('OrderCheckoutService', () => {
  it('returns the existing expired/missing transaction response without Express', async () => {
    const transactionClient = {
      order: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new OrderCheckoutService(
      {
        $transaction: jest.fn(
          async (
            callback: (client: typeof transactionClient) => Promise<unknown>
          ) => callback(transactionClient)
        ),
      } as unknown as PrismaService,
      {} as MailService
    );

    await expect(
      service.checkout({ orderId: 'missing' } as never)
    ).resolves.toEqual({
      status: 400,
      body: { message: 'Giao dịch không tồn tại. Vui lòng tạo hóa đơn khác' },
    });
  });
});
