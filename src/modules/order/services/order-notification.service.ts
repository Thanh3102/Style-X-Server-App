import { Injectable, Logger } from '@nestjs/common';
import { MailService } from 'src/modules/mail/mail.service';

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(private readonly mailService: MailService) {}

  async sendCheckoutComplete<TOrder extends object>(
    order: TOrder,
    email: string,
    customerName: string
  ): Promise<void> {
    try {
      await this.mailService.sendUserCheckoutComplete(
        order,
        email,
        customerName
      );
    } catch (error) {
      this.logFailure('checkout completion', error);
    }
  }

  async sendDeliveryConfirmed<TOrder extends { email: string; name: string }>(
    order: TOrder
  ): Promise<void> {
    try {
      await this.mailService.sendUserDeliveryConfirmNotification(order);
    } catch (error) {
      this.logFailure('delivery confirmation', error);
    }
  }

  private logFailure(notification: string, error: unknown): void {
    const detail = error instanceof Error ? error.stack : String(error);
    this.logger.error(`Unable to send ${notification} notification`, detail);
  }
}
