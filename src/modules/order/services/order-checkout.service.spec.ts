import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/modules/mail/mail.service';
import { OrderCheckoutService } from './order-checkout.service';
import { OrderNotificationService } from './order-notification.service';

jest.mock('src/utils/helper/CustomIDGenerator', () => ({
  generateCustomID: jest.fn().mockResolvedValue('#000001'),
}));

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
      {} as OrderNotificationService
    );

    await expect(
      service.checkout({ orderId: 'missing' } as never)
    ).resolves.toEqual({
      status: 400,
      body: { message: 'Giao dịch không tồn tại. Vui lòng tạo hóa đơn khác' },
    });
  });

  it('keeps checkout successful when notification fails after the transaction commits', async () => {
    const updatedOrder = {
      id: 'order-1',
      items: [],
    };
    const transactionClient = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          expire: String(Date.now() + 60_000),
        }),
        update: jest.fn().mockResolvedValue(updatedOrder),
      },
    };
    let transactionResolved = false;
    const prisma = {
      $transaction: jest.fn(
        async (
          callback: (client: typeof transactionClient) => Promise<unknown>
        ) => {
          const result = await callback(transactionClient);
          transactionResolved = true;
          return result;
        }
      ),
    } as unknown as PrismaService;
    const mailService = {
      sendUserCheckoutComplete: jest.fn(async () => {
        expect(transactionResolved).toBe(true);
        throw new Error('mail provider unavailable');
      }),
    } as unknown as MailService;
    const notificationService = new OrderNotificationService(mailService);
    const service = new OrderCheckoutService(prisma, notificationService);

    await expect(
      service.checkout({
        orderId: 'order-1',
        address: 'Address',
        province: 'Province',
        district: 'District',
        ward: 'Ward',
        email: 'buyer@example.com',
        name: 'Buyer',
        phoneNumber: '0900000000',
        paymentMethod: 'COD',
      } as never)
    ).resolves.toEqual({
      status: 200,
      body: { message: 'Tạo đơn hàng thành công.' },
    });

    expect(mailService.sendUserCheckoutComplete).toHaveBeenCalledWith(
      updatedOrder,
      'buyer@example.com',
      'Buyer'
    );
  });
});
