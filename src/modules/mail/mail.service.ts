import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendUserVerifyOTP(
    email: string,
    name: string,
    otp: string
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      from: 'noreply <support@stylex.com>',
      subject: 'Xác thực đăng ký tài khoản',
      template: './otp-verify',
      context: {
        name,
        otp,
      },
    });
  }

  async sendUserCheckoutComplete<TOrder extends object>(
    order: TOrder,
    email: string,
    customerName: string
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      from: 'noreply <support@stylex.com>',
      subject: 'Tạo đơn hàng thành công',
      template: './checkout-order',
      context: {
        customerName,
        order,
      },
    });
  }

  async sendUserDeliveryConfirmNotification<
    TOrder extends { email: string; name: string },
  >(order: TOrder): Promise<void> {
    await this.mailerService.sendMail({
      to: order.email,
      from: 'noreply <support@stylex.com>',
      subject: 'Thông báo cập nhật trạng thái đơn hàng',
      template: './delivery-notification',
      context: {
        customerName: order.name,
        order,
      },
    });
  }

  async sendResetPasswordLink(
    to: string,
    name: string,
    resetLink: string
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      from: 'noreply <support@stylex.com>',
      subject: 'Yêu cầu đặt lại mật khẩu',
      template: './reset-password',
      context: {
        name,
        resetLink,
      },
    });
  }
}
