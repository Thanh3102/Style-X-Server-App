import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CustomerSignInDTO,
  CustomerSignUpDTO,
  EmployeeSignInDTO,
  VerifySignInDTO,
} from './auth';
import { EmployeesService } from '../employees/employees.service';
import { comparePassword, hashPlainText } from 'src/utils/helper/bcryptHelper';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateOTP } from 'src/utils/helper/OtpGenerator';
import { MailService } from '../mail/mail.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';

@Injectable()
export class AuthService {
  constructor(
    private employeeService: EmployeesService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async employeeSignIn(dto: EmployeeSignInDTO, res: Response) {
    try {
      const employee = await this.employeeService.verifyUser(
        dto.username,
        dto.password,
      );

      await this.employeeService.updateLastLogin(employee.id);

      const { accessToken, refreshToken } = await this.generateToken(
        {
          id: employee.id,
          username: employee.username,
          email: employee.email,
        },
        dto.isRemember,
      );

      return res.status(200).json({
        user: {
          id: employee.id,
          username: employee.username,
          name: employee.name,
          email: employee.email,
        },
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiredIn:
          new Date().getTime() +
          parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRED_TIME_NUMBER),
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }

  async customerSignIn(dto: CustomerSignInDTO, res: Response) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!customer) {
      return res.status(404).json({ message: 'Tài khoản không tồn tại' });
    }

    const isCorrectPW = await comparePassword(dto.password, customer.password);

    if (!isCorrectPW) {
      return res.status(400).json({ message: 'Mật khẩu không chính xác' });
    }

    await this.prisma.customer.update({
      where: {
        email: dto.email,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const { accessToken, refreshToken } = await this.generateToken({
      id: customer.id,
      email: customer.email,
    });

    return res.status(200).json({
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      },
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiredIn:
        new Date().getTime() +
        parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRED_TIME_NUMBER),
    });
  }

  async refreshAccessToken(
    accessToken: string,
    refreshToken: string,
    res: Response,
  ) {
    try {
      const accessTokenPayload = await this.jwtService.verify(accessToken, {
        ignoreExpiration: true,
      });
      const refreshTokenPayload = await this.jwtService.verify(refreshToken);
      if (
        !refreshTokenPayload.type ||
        refreshTokenPayload.type !== 'refresh' ||
        accessTokenPayload.id !== refreshTokenPayload.id
      )
        throw new UnauthorizedException();

      const { iat, exp, expiredIn, ...payload } = accessTokenPayload;

      const newAccessToken = this.jwtService.sign(payload);

      return res.status(200).json({
        accessToken: newAccessToken,
        refreshToken: refreshToken,
        expiredIn:
          new Date().getTime() +
          Number(process.env.JWT_ACCESS_TOKEN_EXPIRED_TIME_NUMBER),
      });
    } catch (error) {
      console.log(error);

      throw new UnauthorizedException();
    }
  }

  private async generateToken(payload: any, isRemember: boolean = false) {
    const accessToken = await this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRED_TIME,
    });

    const refreshTokenExpireTime = isRemember
      ? process.env.JWT_REFRESH_TOKEN_EXPIRED_TIME_REMEMBER
      : process.env.JWT_REFRESH_TOKEN_EXPIRED_TIME;

    const refreshToken = await this.jwtService.sign(
      { type: 'refresh', ...payload },
      {
        expiresIn: refreshTokenExpireTime,
      },
    );

    return { accessToken, refreshToken };
  }

  async customerSignUp(dto: CustomerSignUpDTO, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const exist = await p.customer.findFirst({
            where: {
              email: dto.email,
            },
          });

          if (exist)
            return res.status(400).json({ message: 'Email đã được sử dụng' });

          // Xóa otp cũ (nếu có)
          await p.customerVerify.deleteMany({
            where: {
              email: dto.email,
            },
          });

          // Tạo otp
          const otp = generateOTP();

          const dob = new Date(dto.dob);
          const dateOfBirth = new Date(
            Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate()),
          );

          await p.customerVerify.create({
            data: {
              email: dto.email,
              name: dto.name,
              dob: dateOfBirth,
              gender: dto.gender,
              otp: otp,
              otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
              password: await hashPlainText(dto.password),
            },
          });

          // Gửi email
          await this.mailService.sendUserVerifyOTP(dto.email, dto.name, otp);
        },
        {
          maxWait: 10000,
          timeout: 10000,
        },
      );

      return res
        .status(200)
        .json({ message: 'Mã xác thực gửi tới email của bạn' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async verifySignUpOtp(dto: VerifySignInDTO, res: Response) {
    try {
      const customerVerify = await this.prisma.customerVerify.findUnique({
        where: {
          email: dto.email,
        },
      });

      if (!customerVerify)
        return res.status(404).json({
          message: 'Tài khoản đăng ký không tồn tại. Vui lòng đăng ký lại',
        });

      if (customerVerify.otp === dto.otp) {
        await this.prisma.$transaction(async (p) => {
          const code = await generateCustomID('KH', 'customer');
          await p.customer.create({
            data: {
              code: code,
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

          await p.customerVerify.deleteMany({
            where: {
              email: dto.email,
            },
          });
        });
      } else {
        return res.status(400).json({
          message: 'Mã xác thực không chính xác',
        });
      }

      return res
        .status(200)
        .json({ message: 'Xác thực tài khoản thành công.' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }
}
