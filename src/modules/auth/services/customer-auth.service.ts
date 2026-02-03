import { Injectable, Logger } from '@nestjs/common';
import { CustomerService } from '../../customer/customer.service';
import { TokenService } from './token.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { CustomerSignInDTO, CustomerSignUpDTO, VerifySignUpDTO } from '../auth.dto';
import { CustomerSignInResponseDTO, JWTPayload, SignUpResult, VerifyOtpResult } from '../auth.types';
import { hashPlainText } from 'src/utils/helper/bcryptHelper';
import { generateOTP } from 'src/utils/helper/OtpGenerator';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly customerService: CustomerService,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  async signIn(dto: CustomerSignInDTO): Promise<CustomerSignInResponseDTO> {
    const customer = await this.customerService.verifyCustomer(
      dto.email,
      dto.password
    );

    const payload: JWTPayload = {
      id: String(customer.id),
      email: customer.email,
    };

    const { accessToken, refreshToken } = await this.tokenService.generateTokenPair(payload);

    return {
      user: {
        id: String(customer.id),
        name: customer.name,
        email: customer.email,
      },
      accessToken,
      refreshToken,
      expiredIn: this.tokenService.getExpiredIn(),
    };
  }

  async signUp(dto: CustomerSignUpDTO): Promise<SignUpResult> {
    const result = await this.executeSignUpTransaction(dto);

    if (result.success) {
      await this.mailService.sendUserVerifyOTP(dto.email, dto.name, result.otp);
    }

    return result;
  }

  private async executeSignUpTransaction(dto: CustomerSignUpDTO): Promise<SignUpResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const existingCustomer = await tx.customer.findFirst({
          where: { email: dto.email },
        });

        if (existingCustomer) {
          return { success: false as const, error: 'Email đã được sử dụng' };
        }

        await tx.customerVerify.deleteMany({
          where: { email: dto.email },
        });

        const otp = generateOTP();
        const dob = new Date(dto.dob);
        const dateOfBirth = new Date(
          Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate())
        );

        await tx.customerVerify.create({
          data: {
            email: dto.email,
            name: dto.name,
            dob: dateOfBirth,
            gender: dto.gender,
            otp,
            otpExpiry: new Date(Date.now() + AUTH_CONSTANTS.OTP_EXPIRY_MS),
            password: await hashPlainText(dto.password),
          },
        });

        return { success: true as const, otp };
      },
      {
        maxWait: AUTH_CONSTANTS.TRANSACTION_TIMEOUT_MS,
        timeout: AUTH_CONSTANTS.TRANSACTION_TIMEOUT_MS,
      }
    );
  }

  async verifySignUpOtp(dto: VerifySignUpDTO): Promise<VerifyOtpResult> {
    const customerVerify = await this.prisma.customerVerify.findUnique({
      where: { email: dto.email },
    });

    if (!customerVerify) {
      return {
        success: false,
        error: 'Tài khoản đăng ký không tồn tại. Vui lòng đăng ký lại',
        statusCode: 404,
      };
    }

    if (customerVerify.otp !== dto.otp) {
      return {
        success: false,
        error: 'Mã xác thực không chính xác',
        statusCode: 400,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      const code = await generateCustomID('KH', 'customer');
      await tx.customer.create({
        data: {
          code,
          name: customerVerify.name,
          password: customerVerify.password,
          dob: customerVerify.dob,
          email: customerVerify.email,
          gender: customerVerify.gender,
          cart: {
            create: {},
          },
        },
      });

      await tx.customerVerify.deleteMany({
        where: { email: dto.email },
      });
    });

    return { success: true, message: 'Xác thực tài khoản thành công.' };
  }
}
