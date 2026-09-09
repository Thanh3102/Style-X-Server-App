import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  JWTPayload,
  AccessTokenVerifyPayload,
  JWTToken,
  RefreshTokenVerifyPayload,
} from '../auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async generateTokenPair(
    payload: JWTPayload,
    isRemember: boolean = false
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>(
        'JWT_ACCESS_TOKEN_EXPIRED_TIME'
      ),
    });

    const refreshTokenExpireTime = isRemember
      ? this.configService.get<string>(
          'JWT_REFRESH_TOKEN_EXPIRED_TIME_REMEMBER'
        )
      : this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRED_TIME');

    const refreshToken = await this.jwtService.signAsync(
      { type: 'refresh', ...payload },
      {
        expiresIn: refreshTokenExpireTime,
      }
    );

    return { accessToken, refreshToken };
  }

  getExpiredIn(): number {
    return (
      new Date().getTime() +
      parseInt(
        this.configService.get<string>(
          'JWT_ACCESS_TOKEN_EXPIRED_TIME_NUMBER'
        ) ?? '0',
        10
      )
    );
  }

  async verifyAccessToken(
    token: string,
    ignoreExpiration: boolean = false
  ): Promise<AccessTokenVerifyPayload> {
    return this.jwtService.verify(token, { ignoreExpiration });
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenVerifyPayload> {
    return this.jwtService.verify(token);
  }

  async signNewAccessToken(payload: JWTPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  buildTokenResponse(accessToken: string, refreshToken: string): JWTToken {
    return {
      accessToken,
      refreshToken,
      expiredIn: this.getExpiredIn(),
    };
  }
}
