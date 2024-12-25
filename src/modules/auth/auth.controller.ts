import { Body, Controller, Post, Req, Res, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CustomerSignInDTO, CustomerSignUpDTO, EmployeeSignInDto, RefreshTokenDTO, VerifySignInDTO } from './auth.dto';
import { Public } from 'src/decorators/public.decorator';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';

@UseInterceptors(LoggerInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/employee/sign-in')
  signIn(@Body() dto: EmployeeSignInDto, @Res() res: Response) {
    return this.authService.employeeSignIn(dto, res);
  }

  @Post('/refreshToken')
  refreshToken(@Body() dto: RefreshTokenDTO, @Res() res: Response) {
    return this.authService.refreshAccessToken(
      dto.accessToken,
      dto.refreshToken,
      res,
    );
  }

  @Public()
  @Post('/customer/signin')
  customerSignIn(@Body() dto: CustomerSignInDTO, @Res() res) {
    return this.authService.customerSignIn(dto, res);
  }

  @Public()
  @Post('/customer/signup')
  customerSignUp(@Body() dto: CustomerSignUpDTO, @Res() res) {
    return this.authService.customerSignUp(dto, res);
  }

  @Public()
  @Post('/customer/signup/verify')
  verifySignUpOtp(@Body() dto: VerifySignInDTO, @Res() res) {
    return this.authService.verifySignUpOtp(dto, res);
  }
}
