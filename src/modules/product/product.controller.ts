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
import { Public } from 'src/decorators/public.decorator';
import { CreateCollectionDTO, PublicProductParams } from './product';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { ProductQueryService } from './services/product-query.service';
import { ProductCommandService } from './services/product-command.service';
import { CategoryService } from './services/category.service';
import { CollectionService } from './services/collection.service';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('product')
export class ProductController {
  constructor(
    private productQueryService: ProductQueryService,
    private productCommandService: ProductCommandService,
    private categoryService: CategoryService,
    private collectionService: CollectionService
  ) {}

  @Public()
  @Get('/public')
  getProductPublic(@Query() queryParams: PublicProductParams, @Res() res) {
    return this.productQueryService.fetchProductPublic(queryParams, res);
  }

  @Public()
  @Get('/public/search')
  getProductPublicSearch(@Query('q') query: string, @Res() res) {
    return this.productQueryService.searchProductPublic(query, res);
  }

  @Public()
  @Get('/collection')
  getCollection(@Res() res: Response) {
    return this.collectionService.getCollection(res);
  }

  @Public()
  @Get('/public/collection/:slug')
  getCollectionDetail(@Param('slug') slug: string, @Res() res) {
    return this.productQueryService.getCollectionDetail(slug, res);
  }

  @Public()
  @Get('/public/:id')
  getProductDetailPublic(@Param('id') id: string, @Res() res: Response) {
    if (!isInteger(id))
      return res.status(400).json({ message: 'Sản phẩm không tồn tại' });
    return this.productQueryService.fetchProductDetailPublic(parseInt(id), res);
  }

  @Public()
  @Get('/category')
  getCategory(@Query() queryParams: QueryParams) {
    return this.productQueryService.getCategories(queryParams);
  }

  @Get('/variant/:variantId')
  @Permissions(ProductPermission.Access)
  getVariantDetail(@Param('variantId') variantId: string) {
    if (!isInteger(variantId))
      throw new BadRequestException('Mã phiên bản không hợp lệ');
    return this.productQueryService.getVariantDetail(parseInt(variantId));
  }

  @Post('/category')
  @Permissions(CategoryPermission.Create)
  @UseInterceptors(FileInterceptor('image'))
  createCategories(
    @UploadedFile() image: Express.Multer.File,
    @Body() dto: CreateCategoryDTO,
    @Req() req,
    @Res() res: Response
  ) {
    return this.categoryService.createCategory(
      {
        ...dto,
        image,
      },
      req,
      res
    );
  }

  @Post('/category/update')
  @Permissions(CategoryPermission.Update)
  @UseInterceptors(FileInterceptor('image'))
  updateCategory(
    @UploadedFile() image: Express.Multer.File,
    @Body() dto: UpdateCategoryDTO,
    @Req() req,
    @Res() res: Response
  ) {
    return this.categoryService.updateCategory({ ...dto, image }, req, res);
  }

  @Delete('/category/:id')
  @Permissions(CategoryPermission.Delete)
  deleteCategory(@Param('id') id: string, @Res() res: Response) {
    return this.categoryService.deleteCategory(parseInt(id), res);
  }

  @Post('/collection')
  @Permissions(CategoryPermission.Create)
  createCollection(
    @Body() dto: CreateCollectionDTO,
    @Req() req,
    @Res() res: Response
  ) {
    return this.collectionService.createCollection(dto, req, res);
  }

  @Put('/collection')
  @Permissions(CategoryPermission.Update)
  updateCollection(
    @Body() dto: UpdateCategoryDTO,
    @Req() req,
    @Res() res: Response
  ) {
    return this.collectionService.updateCollection(dto, req, res);
  }

  @Delete('/collection/:id')
  @Permissions(CategoryPermission.Delete)
  deleteCollection(@Param('id') id: string, @Res() res: Response) {
    return this.collectionService.deleteCollection(parseInt(id), res);
  }

  @Put('/images/updateMainImage')
  @Permissions(ProductPermission.Update)
  updateMainImage(
    @Body() { id, image }: { image: string; id: string },
    @Res() res: Response
  ) {
    return this.productCommandService.updateMainImage(parseInt(id), image, res);
  }

  @UseInterceptors(FilesInterceptor('images'))
  @Permissions(ProductPermission.Update)
  @Post('/images/add')
  addImages(
    @UploadedFiles() images: Array<Express.Multer.File>,
    @Body() { productId }: { productId: string },
    @Res() res: Response
  ) {
    return this.productCommandService.addImage(
      parseInt(productId),
      images,
      res
    );
  }

  @Delete('/images')
  @Permissions(ProductPermission.Update)
  deleteProductImage(
    @Body() { url, publicId }: { publicId: string; url: string },
    @Res() res
  ) {
    return this.productCommandService.deleteImage(url, publicId, res);
  }

  @Put('/variant')
  @Permissions(ProductPermission.Update)
  updateVariant(@Body() dto: UpdateVariantDTO, @Res() res: Response) {
    return this.productCommandService.updateVariant(dto, res);
  }

  @Get('/:id')
  @Permissions(ProductPermission.Access)
  getDetail(@Param() params, @Res() res: Response) {
    return this.productQueryService.getDetail(parseInt(params.id), res);
  }

  @Get('/')
  @Permissions(ProductPermission.Access)
  get(@Query() queryParams: QueryParams, @Res() res: Response) {
    return this.productQueryService.get(queryParams, res);
  }

  @Post('/')
  @Permissions(ProductPermission.Create)
  @UseInterceptors(FilesInterceptor('images'))
  create(
    @UploadedFiles() images: Array<Express.Multer.File>,
    @Body() dto: CreateProductDTO,
    @Req() req,
    @Res() res: Response
  ) {
    const data = JSON.parse(dto.productData);
    return this.productCommandService.create(
      { ...data, images: images },
      req,
      res
    );
  }

  @Put('/')
  @Permissions(ProductPermission.Update)
  update(@Body() dto: UpdateProductDTO, @Req() req, @Res() res) {
    return this.productCommandService.update(dto, req, res);
  }

  @Delete('/:productId')
  @Permissions(ProductPermission.Delete)
  delete(@Param('productId') id: string, @Res() res) {
    return this.productCommandService.delete(parseInt(id), res);
  }
}
