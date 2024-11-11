import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateSupplierDTO {
  @IsNotEmpty({ message: 'Tên nhà cung cấp không được để trống' })
  name: string;

  @IsOptional()
  code: string;

  @IsOptional()
  phoneNumber: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  taxCode: string;

  @IsOptional()
  website: string;

  @IsOptional()
  fax: string;

  @IsOptional()
  country: string;

  @IsOptional()
  province: string;

  @IsOptional()
  district: string;

  @IsOptional()
  ward: string;

  @IsOptional()
  detailAddress: string;

  @IsString()
  assignedId: string;

  @IsArray()
  tags: string[];
}

export class UpdateSupplierDTO {
  @IsNotEmpty({ message: 'Id không hợp lệ' })
  id: number;

  @IsNotEmpty({ message: 'Tên nhà cung cấp không được để trống' })
  name: string;

  @IsOptional()
  code: string;

  @IsOptional()
  phoneNumber: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  taxCode: string;

  @IsOptional()
  website: string;

  @IsOptional()
  fax: string;

  @IsOptional()
  country: string;

  @IsOptional()
  province: string;

  @IsOptional()
  district: string;

  @IsOptional()
  ward: string;

  @IsOptional()
  detailAddress: string;

  @IsNumber()
  assignedId: number;

  @IsBoolean()
  active: boolean

  @IsArray()
  tags: string[];
}

