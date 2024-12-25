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
  UpdateCategoryDTO,
  UpdateProductDTO,
  UpdateVariantDTO,
} from './product.dto';
import { Response } from 'express';
import {
  CategoryPermission,
  ProductPermission,
  QueryParams,
} from 'src/utils/types';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { isInteger } from 'src/utils/helper/StringHelper';
import { Public } from 'src/decorators/Public.decorator';
import { CreateCollectionDTO, PublicProductParams } from './product';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionsGuard } from 'src/guards/permissions.guard';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('product')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Public()
  @Get('/public')
  getProductPublic(@Query() queryParams: PublicProductParams, @Res() res) {
    return this.productService.fetchProductPublic(queryParams, res);
  }

  @Public()
  @Get('/public/search')
  getProductPublicSearch(@Query('q') query: string, @Res() res) {
    return this.productService.searchProductPublic(query, res);
  }

  @Public()
  @Get('/collection')
  getCollection(@Res() res: Response) {
    return this.productService.getCollection(res);
  }

  @Public()
  @Get('/public/collection/:slug')
  getCollectionDetail(@Param('slug') slug: string, @Res() res) {
    return this.productService.getCollectionDetail(slug, res);
  }

  @Public()
  @Get('/public/:id')
  getProductDetailPublic(@Param('id') id: string, @Res() res: Response) {
    if (!isInteger(id))
      return res.status(400).json({ message: 'Sản phẩm không tồn tại' });
    return this.productService.fetchProductDetailPublic(parseInt(id), res);
  }

  @Public()
  @Get('/category')
  getCategory(@Query() queryParams: QueryParams) {
    return this.productService.getCategories(queryParams);
  }

  @Get('/variant/:variantId')
  @Permissions(ProductPermission.Access)
  getVariantDetail(@Param('variantId') variantId: string) {
    if (!isInteger(variantId))
      throw new BadRequestException('Mã phiên bản không hợp lệ');
    return this.productService.getVariantDetail(parseInt(variantId));
  }

  @Post('/category')
  @Permissions(CategoryPermission.Create)
  @UseInterceptors(FileInterceptor('image'))
  createCategories(
    @UploadedFile() image: Express.Multer.File,
    @Body() dto: CreateCategoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.productService.createCategory(
      {
        ...dto,
        image,
      },
      req,
      res,
    );
  }

  @Post('/category/update')
  @Permissions(CategoryPermission.Update)
  @UseInterceptors(FileInterceptor('image'))
  updateCategory(
    @UploadedFile() image: Express.Multer.File,
    @Body() dto: UpdateCategoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.productService.updateCategory({ ...dto, image }, req, res);
  }

  @Delete('/category/:id')
  @Permissions(CategoryPermission.Delete)
  deleteCategory(@Param('id') id: string, @Res() res: Response) {
    return this.productService.deleteCategory(parseInt(id), res);
  }

  @Post('/collection')
  @Permissions(CategoryPermission.Create)
  createCollection(
    @Body() dto: CreateCollectionDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.productService.createCollection(dto, req, res);
  }

  @Put('/collection')
  @Permissions(CategoryPermission.Update)
  updateCollection(
    @Body() dto: UpdateCategoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.productService.updateCollection(dto, req, res);
  }

  @Delete('/collection/:id')
  @Permissions(CategoryPermission.Delete)
  deleteCollection(@Param('id') id: string, @Res() res: Response) {
    return this.productService.deleteCollection(parseInt(id), res);
  }

  @Put('/images/updateMainImage')
  @Permissions(ProductPermission.Update)
  updateMainImage(
    @Body() { id, image }: { image: string; id: string },
    @Res() res: Response,
  ) {
    return this.productService.updateMainImage(parseInt(id), image, res);
  }

  @UseInterceptors(FilesInterceptor('images'))
  @Permissions(ProductPermission.Update)
  @Post('/images/add')
  addImages(
    @UploadedFiles() images: Array<Express.Multer.File>,
    @Body() { productId }: { productId: string },
    @Res() res: Response,
  ) {
    return this.productService.addImage(parseInt(productId), images, res);
  }

  @Delete('/images')
  @Permissions(ProductPermission.Update)
  deleteProductImage(
    @Body() { url, publicId }: { publicId: string; url: string },
    @Res() res,
  ) {
    return this.productService.deleteImage(url, publicId, res);
  }

  @Put('/variant')
  @Permissions(ProductPermission.Update)
  updateVariant(@Body() dto: UpdateVariantDTO, @Res() res: Response) {
    return this.productService.updateVariant(dto, res);
  }

  @Get('/:id')
  @Permissions(ProductPermission.Access)
  getDetail(@Param() params, @Res() res: Response) {
    return this.productService.getDetail(parseInt(params.id), res);
  }

  @Get('/')
  @Permissions(ProductPermission.Access)
  get(@Query() queryParams: QueryParams, @Res() res: Response) {
    return this.productService.get(queryParams, res);
  }

  @Post('/')
  @Permissions(ProductPermission.Create)
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
  @Permissions(ProductPermission.Update)
  update(@Body() dto: UpdateProductDTO, @Req() req, @Res() res) {
    return this.productService.update(dto, req, res);
  }

  @Delete('/:productId')
  @Permissions(ProductPermission.Delete)
  delete(@Param('productId') id: string, @Res() res) {
    return this.productService.delete(parseInt(id), res);
  }
}
