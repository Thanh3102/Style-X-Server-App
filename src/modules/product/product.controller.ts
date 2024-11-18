import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { JwtGuard } from 'src/guards/jwt.guard';
import {
  CreateCategoryDTO,
  CreateProductDTO,
  UpdateProductDTO,
  UpdateVariantDTO,
} from './product.dto';
import { Response } from 'express';
import { QueryParams } from 'src/utils/types';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { isInteger } from 'src/utils/helper/StringHelper';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('product')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Get('/category')
  getCategory(@Query() queryParams: QueryParams) {
    return this.productService.getCategories(queryParams);
  }

  @Get("/variant/:variantId")
  getVariantDetail(@Param("variantId") variantId: string){
    if(!isInteger(variantId)) throw new BadRequestException("Mã phiên bản không hợp lệ")
    return this.productService.getVariantDetail(parseInt(variantId))
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

  @Put('/images/updateMainImage')
  updateMainImage(
    @Body() { id, image }: { image: string; id: string },
    @Res() res: Response,
  ) {
    return this.productService.updateMainImage(parseInt(id), image, res);
  }

  @UseInterceptors(FilesInterceptor('images'))
  @Post('/images/add')
  addImages(
    @UploadedFiles() images: Array<Express.Multer.File>,
    @Body() { productId }: { productId: string },
    @Res() res: Response,
  ) {
    return this.productService.addImage(parseInt(productId), images, res);
  }

  @Delete('/images')
  deleteProductImage(
    @Body() { url, publicId }: { publicId: string; url: string },
    @Res() res,
  ) {
    return this.productService.deleteImage(url, publicId, res);
  }

  @Put('/variant')
  updateVariant(@Body() dto: UpdateVariantDTO, @Res() res: Response) {
    return this.productService.updateVariant(dto, res);
  }

  @Get('/:id')
  getDetail(@Param() params, @Res() res: Response) {
    return this.productService.getDetail(parseInt(params.id), res);
  }

  @Get('/')
  get(@Query() queryParams: QueryParams, @Res() res: Response) {
    return this.productService.get(queryParams, res);
  }

  @Post('/')
  @UseInterceptors(FilesInterceptor('images'))
  create(
    @UploadedFiles() images: Array<Express.Multer.File>,
    @Body() dto: CreateProductDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    const data = JSON.parse(dto.productData);
    return this.productService.create({ ...data, images: images }, req, res);
  }

  @Put('/')
  update(@Body() dto: UpdateProductDTO, @Req() req, @Res() res) {
    return this.productService.update(dto, req, res);
  }

  @Delete('/')
  delete() {
    return null;
  }
}
