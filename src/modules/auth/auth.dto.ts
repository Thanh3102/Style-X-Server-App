import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EmployeeSignInDto {
  @IsNotEmpty({ message: 'Tên đăng nhập không thể để trống' })
  username: string;

  @IsNotEmpty({ message: 'Mật khẩu không thể để trống' })
  password: string;

  @IsBoolean()
  // @Transform(({ value }) => value === 'true')
  isRemember: boolean;
}

export class RefreshTokenDTO {
  @IsNotEmpty({ message: 'Access token not found' })
  @IsString()
  accessToken: string;

  @IsNotEmpty({ message: 'Refresh token not found' })
  @IsString()
  refreshToken: string;
}

export class CustomerSignUpDTO {
  name: string;
  email: string;
  password: string;
  gender: string;
  dob: Date;
}

export class VerifySignInDTO {
  otp: string;
  email: string;
}

export type CustomerSignInDTO = {
  email: string;
  password: string;
};
