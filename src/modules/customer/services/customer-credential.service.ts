import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Customer } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword, hashPlainText } from 'src/utils/helper/bcryptHelper';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class CustomerCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async createForgetPasswordToken(email: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        email,
      },
    });

    if (!customer) {
      throw new NotFoundException('Email của bạn chưa được đăng ký');
    }

    await this.prisma.resetPasswordToken.deleteMany({
      where: {
        customerId: customer.id,
      },
    });

    const resetTokenId = uuidv4();
    const token = await this.jwtService.sign(resetTokenId, {
      secret: this.configService.get<string>('JWT_RESET_PASSWORD_SECRET_KEY'),
    });
    const resetLink = `${this.configService.get<string>(
      'CLIENT_BASE_URL'
    )}/reset-password?token=${token}`;

    await this.prisma.resetPasswordToken.create({
      data: {
        customerId: customer.id,
        token: resetTokenId,
        expires:
          Date.now() +
          Number(this.configService.get<string>('RESET_PASSWORD_EXPIRES')),
      },
    });

    void this.mailService.sendResetPasswordLink(
      customer.email,
      customer.name,
      resetLink
    );
  }

  async resetPassword(
    requestToken: string,
    newPassword: string
  ): Promise<void> {
    let verifyPayload: string;

    try {
      const payload: unknown = await this.jwtService.verify(requestToken, {
        secret: this.configService.get<string>('JWT_RESET_PASSWORD_SECRET_KEY'),
      });
      if (typeof payload !== 'string') {
        throw new Error('Invalid reset token payload');
      }
      verifyPayload = payload;
    } catch {
      throw new BadRequestException(
        'Yêu cầu không hợp lệ. Vui lòng tạo yêu cầu mới'
      );
    }

    const resetToken = await this.prisma.resetPasswordToken.findFirst({
      where: {
        token: verifyPayload,
      },
    });

    if (!resetToken || Date.now() > resetToken.expires) {
      throw new NotFoundException(
        'Yêu cầu không tồn tại hoặc đã hết hạn. Vui lòng tạo yêu cầu mới'
      );
    }

    await this.prisma.customer.update({
      where: {
        id: resetToken.customerId,
      },
      data: {
        password: await hashPlainText(newPassword),
      },
    });
  }

  async verifyCustomer(email: string, password: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: {
        email,
      },
    });

    if (!customer) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const isCorrectPassword = await comparePassword(
      password,
      customer.password
    );

    if (!isCorrectPassword) {
      throw new BadRequestException('Mật khẩu không chính xác');
    }

    await this.prisma.customer.update({
      where: {
        email,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return customer;
  }
}
