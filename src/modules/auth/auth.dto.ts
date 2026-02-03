import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class EmployeeSignInDTO {
  @IsNotEmpty({ message: 'Tên đăng nhập không thể để trống' })
  username: string;

  @IsNotEmpty({ message: 'Mật khẩu không thể để trống' })
  password: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isRemember?: boolean = false;
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
  @IsNotEmpty({ message: 'Họ tên không thể để trống' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Email không thể để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsNotEmpty({ message: 'Mật khẩu không thể để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsNotEmpty({ message: 'Giới tính không thể để trống' })
  @IsString()
  gender: string;

  @IsNotEmpty({ message: 'Ngày sinh không thể để trống' })
  dob: Date;
}

export class VerifySignUpDTO {
  @IsNotEmpty({ message: 'Mã OTP không thể để trống' })
  @IsString()
  otp: string;

  @IsNotEmpty({ message: 'Email không thể để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;
}

export class CustomerSignInDTO {
  @IsNotEmpty({ message: 'Email không thể để trống' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsNotEmpty({ message: 'Mật khẩu không thể để trống' })
  password: string;
}
