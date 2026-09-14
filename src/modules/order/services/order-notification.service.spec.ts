import { MailService } from 'src/modules/mail/mail.service';
import { OrderNotificationService } from './order-notification.service';

describe('OrderNotificationService', () => {
  it('absorbs a checkout notification failure after persistence has completed', async () => {
    const mailService = {
      sendUserCheckoutComplete: jest
        .fn()
        .mockRejectedValue(new Error('mail provider unavailable')),
    } as unknown as MailService;
    const service = new OrderNotificationService(mailService);

    await expect(
      service.sendCheckoutComplete(
        { id: 'order-1' },
        'buyer@example.com',
        'Buyer'
      )
    ).resolves.toBeUndefined();
  });
});
