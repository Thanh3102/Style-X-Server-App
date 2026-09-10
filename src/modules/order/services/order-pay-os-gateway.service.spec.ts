import { PrismaService } from 'src/prisma/prisma.service';
import { OrderPayOsGatewayService } from './order-pay-os-gateway.service';
import { OrderNotificationService } from './order-notification.service';
import { MailService } from 'src/modules/mail/mail.service';

describe('OrderPayOsGatewayService', () => {
  it('keeps the PayOS success workflow resolved when notification fails after status persistence', async () => {
    const order = { id: 'order-1', email: 'buyer@example.com' };
    const update = jest.fn().mockResolvedValue(order);
    let statusPersisted = false;
    update.mockImplementation(async () => {
      statusPersisted = true;
      return order;
    });
    const mailService = {
      sendUserCheckoutComplete: jest.fn(async () => {
        expect(statusPersisted).toBe(true);
        throw new Error('mail provider unavailable');
      }),
    } as unknown as MailService;
    const notificationService = new OrderNotificationService(mailService);
    const service = new OrderPayOsGatewayService(
      {
        order: { update },
      } as unknown as PrismaService,
      notificationService,
      {} as never
    );

    await expect(
      service.markPaymentSucceeded('order-1')
    ).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { transactionStatus: expect.any(String) },
    });
    expect(mailService.sendUserCheckoutComplete).toHaveBeenCalledWith(
      order,
      order.email,
      order.email
    );
  });
});
