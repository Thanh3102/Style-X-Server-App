import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class WarehouseDTO {
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsNotEmpty()
  onHand: number;
}

export class OptionDTO {
  @IsString()
  @IsOptional()
  name: string;

  @IsNumber()
  @IsOptional()
  position: string;

  @IsArray()
  values: string[];
}

export class Variant {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  option1: string;

  @IsString()
  @IsOptional()
  option2: string;

  @IsString()
  @IsOptional()
  option3: string;

  @IsString()
  @IsOptional()
  skuCode: string;

  @IsString()
  @IsOptional()
  barCode: string;

  @IsString()
  @IsOptional()
  unit: string;

  @IsNumber()
  @Min(0)
  @Max(1e12)
  sellPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1e12)
  costPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1e12)
  comparePrice: number;

  @IsArray()
  @ValidateNested()
  @Type(() => WarehouseDTO)
  warehouses: WarehouseDTO[];
}
export class CreateCategoryDTO {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  slug: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;
}

export class CreateProductDataDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  skuCode: string;

  @IsString()
  @IsOptional()
  barCode: string;

  @IsString()
  @IsOptional()
  unit: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsString()
  @IsOptional()
  shortDescription: string;

  @IsNumber()
  @Min(0)
  @Max(1e12)
  sellPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1e12)
  costPrice: number;

  @IsNumber()
  @Min(0)
  @Max(1e12)
  comparePrice: number;

  @IsBoolean()
  avaiable: boolean;

  @IsArray()
  @ValidateNested()
  @Type(() => WarehouseDTO)
  warehouses: WarehouseDTO[];

  @IsString()
  @IsOptional()
  vendor: string;

  @IsString()
  @IsOptional()
  type: string;

  @IsArray()
  @ValidateNested()
  @Type(() => OptionDTO)
  options: OptionDTO;

  @IsArray()
  @ValidateNested()
  @Type(() => Variant)
  variants: Variant[];

  @IsArray()
  tags: string[];

  @IsArray()
  categoryIds: number[];
}

export class CreateProductDTO {
  // images: File[];
  productData: string;
}

export class UpdateProductDTO {
  id: number;
  name: string;
  avaiable: boolean;
  description: string | undefined;
  shortDescription: undefined;
  type: string | undefined;
  vendor: string | undefined;
  addTags: string[];
  deleteTags: string[];
  addCategoryIds: number[];
  deleteCategoryIds: number[];
}

export class UpdateVariantDTO {
  variantId: number;
  barCode: string | undefined;
  comparePrice: number | undefined;
  costPrice: number | undefined;
  sellPrice: number | undefined;
  skuCode: string | undefined;
  unit: string | undefined;
}

