import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async sendUserVerifyOTP(email: string, name: string, otp: string) {
    await this.mailerService.sendMail({
      to: email,
      from: 'noreply <support@stylex.com>',
      subject: 'Xác thực đăng ký tài khoản',
      template: './otp-verify',
      context: {
        name: name,
        otp: otp,
      },
    });
  }

  async sendUserCheckoutComplete(
    order: any,
    email: string,
    customerName: string,
  ) {
    await this.mailerService.sendMail({
      to: email,
      from: 'noreply <support@stylex.com>',
      subject: 'Tạo đơn hàng thành công',
      template: './checkout-order',
      context: {
        customerName: customerName,
        order: order,
      },
    });
  }

  async sendUserDeliveryConfirmNotification(order: any) {
    await this.mailerService.sendMail({
      to: order.email,
      from: 'noreply <support@stylex.com>',
      subject: 'Thông báo cập nhật trạng thái đơn hàng',
      template: './delivery-notification',
      context: {
        customerName: order.name,
        order: order,
      },
    });
  }

  async sendResetPasswordLink(to: string, name: string, resetLink: string) {
    await this.mailerService.sendMail({
      to: to,
      from: 'noreply <support@stylex.com>',
      subject: 'Yêu cầu đặt lại mật khẩu',
      template: './reset-password',
      context: {
        name: name,
        resetLink: resetLink,
      },
    });
  }
}
