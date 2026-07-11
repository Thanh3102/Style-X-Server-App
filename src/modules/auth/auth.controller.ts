import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CustomerSignInDTO,
  CustomerSignUpDTO,
  EmployeeSignInDTO,
  RefreshTokenDTO,
  VerifySignUpDTO,
} from './auth.dto';
import { Public } from 'src/decorators/public.decorator';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import {
  CustomerSignInResponseDTO,
  EmployeeSignInResponseDTO,
  JWTToken,
} from './auth.types';

@UseInterceptors(LoggerInterceptor)
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('/employee/sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: EmployeeSignInDTO): Promise<EmployeeSignInResponseDTO> {
    try {
      return await this.authService.employeeSignIn(dto);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`employeeSignIn failed: ${message}`, stack);
      throw new InternalServerErrorException(message);
    }
  }

  @Post('/refreshToken')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() dto: RefreshTokenDTO): Promise<JWTToken> {
    return this.authService.refreshAccessToken(dto.accessToken, dto.refreshToken);
  }

  @Public()
  @Post('/customer/signin')
  @HttpCode(HttpStatus.OK)
  async customerSignIn(@Body() dto: CustomerSignInDTO): Promise<CustomerSignInResponseDTO> {
    try {
      return await this.authService.customerSignIn(dto);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`customerSignIn failed: ${message}`, stack);
      throw new InternalServerErrorException(message);
    }
  }

  @Public()
  @Post('/customer/signup')
  @HttpCode(HttpStatus.OK)
  async customerSignUp(@Body() dto: CustomerSignUpDTO): Promise<{ message: string }> {
    try {
      const result = await this.authService.customerSignUp(dto);

      if (result.success === false) {
        throw new BadRequestException(result.error);
      }

      return { message: 'Mã xác thực gửi tới email của bạn' };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`customerSignUp failed: ${message}`, stack);
      throw new InternalServerErrorException(message);
    }
  }

  @Public()
  @Post('/customer/signup/verify')
  @HttpCode(HttpStatus.OK)
  async verifySignUpOtp(@Body() dto: VerifySignUpDTO): Promise<{ message: string }> {
    try {
      const result = await this.authService.verifySignUpOtp(dto);

      if (result.success === false) {
        if (result.statusCode === 404) {
          throw new NotFoundException(result.error);
        }
        throw new BadRequestException(result.error);
      }

      return { message: result.message };
    } catch (error: unknown) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`verifySignUpOtp failed: ${message}`, stack);
      throw new InternalServerErrorException(message);
    }
  }
}
