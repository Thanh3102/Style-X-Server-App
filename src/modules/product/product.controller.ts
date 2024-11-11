import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { JwtGuard } from 'src/guards/jwt.guard';
import { CreateCategoryDTO } from './product.dto';
import { Response } from 'express';
import { Public } from 'src/decorators/Public.decorator';
import { QueryParams } from 'src/utils/types';

@UseGuards(JwtGuard)
@Controller('product')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Public()
  @Get('/category')
  getCategory(@Query() queryParams: QueryParams) {
    return this.productService.getCategories(queryParams);
  }

  @Post('/createCategory')
  createCategories(
    @Body() dto: CreateCategoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    // return this.productService.createCategories(dto, req, res);
    return null;
  }

  @Put('/updateCategory')
  updateCategory() {
    return null;
  }

  @Delete('/deleteCategory')
  deleteCategory() {
    return null;
  }
}
