import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { EmployeeSignInDTO } from './auth';
import { EmployeesService } from '../employees/employees.service';
import { comparePassword } from 'src/utils/helper/bcryptHelper';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private employeeService: EmployeesService,
    private jwtService: JwtService,
  ) {}

  async employeeSignIn(dto: EmployeeSignInDTO, res: Response) {
    const employee = await this.employeeService.verifyUser(
      dto.username,
      dto.password,
    );

    if (!employee)
      throw new InternalServerErrorException(
        'Đang xảy ra lỗi trong quá trình đăng nhập',
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
}
