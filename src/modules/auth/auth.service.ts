import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  CustomerSignInResponseDTO,
  EmployeeSignInResponseDTO,
  JWTToken,
  SignUpResult,
  VerifyOtpResult,
} from './auth.types';
import {
  CustomerSignInDTO,
  CustomerSignUpDTO,
  EmployeeSignInDTO,
  VerifySignUpDTO,
} from './auth.dto';
import { CustomerAuthService } from './services/customer-auth.service';
import { EmployeeAuthService } from './services/employee-auth.service';
import { TokenService } from './services/token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly employeeAuthService: EmployeeAuthService,
    private readonly tokenService: TokenService
  ) {}

  async employeeSignIn(dto: EmployeeSignInDTO): Promise<EmployeeSignInResponseDTO> {
    return this.employeeAuthService.signIn(dto);
  }

  async customerSignIn(dto: CustomerSignInDTO): Promise<CustomerSignInResponseDTO> {
    return this.customerAuthService.signIn(dto);
  }

  async refreshAccessToken(accessToken: string, refreshToken: string): Promise<JWTToken> {
    const accessTokenPayload = await this.tokenService.verifyAccessToken(accessToken, true);
    const refreshTokenPayload = await this.tokenService.verifyRefreshToken(refreshToken);

    if (
      !refreshTokenPayload.type ||
      refreshTokenPayload.type !== 'refresh' ||
      accessTokenPayload.id !== refreshTokenPayload.id
    ) {
      throw new UnauthorizedException();
    }

    const { iat, exp, expiredIn, ...payload } = accessTokenPayload;
    const newAccessToken = await this.tokenService.signNewAccessToken(payload);
    
    return this.tokenService.buildTokenResponse(newAccessToken, refreshToken);
  }

  async customerSignUp(dto: CustomerSignUpDTO): Promise<SignUpResult> {
    return this.customerAuthService.signUp(dto);
  }

  async verifySignUpOtp(dto: VerifySignUpDTO): Promise<VerifyOtpResult> {
    return this.customerAuthService.verifySignUpOtp(dto);
  }
}
