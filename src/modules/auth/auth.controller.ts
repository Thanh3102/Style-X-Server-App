import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { EmployeeSignInDto, RefreshTokenDTO } from './auth.dto';

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
}
