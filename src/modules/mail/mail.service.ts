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
}
