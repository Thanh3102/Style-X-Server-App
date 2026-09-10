import { MailService } from 'src/modules/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderPayOsGatewayService } from './order-pay-os-gateway.service';

describe('OrderPayOsGatewayService', () => {
  it('marks a successful PayOS callback and sends the checkout email', async () => {
    const order = { id: 'order-1', email: 'buyer@example.com' };
    const update = jest.fn().mockResolvedValue(order);
    const mailService = {
      sendUserCheckoutComplete: jest.fn(),
    } as unknown as MailService;
    const service = new OrderPayOsGatewayService(
      {
        order: { update },
      } as unknown as PrismaService,
      mailService,
      {} as never
    );

    await service.markPaymentSucceeded('order-1');

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
