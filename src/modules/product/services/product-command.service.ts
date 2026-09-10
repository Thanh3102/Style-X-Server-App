import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest } from 'src/utils/types';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import {
  CreateProductDTO,
  UpdateProductDTO,
  UpdateVariantDTO,
} from '../product';
import { ProductCacheService } from './product-cache.service';
import { ProductMediaService } from './product-media.service';
import { ProductMutationService } from './product-mutation.service';

@Injectable()
export class ProductCommandService {
  private readonly logger = new Logger(ProductCommandService.name);

  constructor(
    private readonly productMutationService: ProductMutationService,
    private readonly productMediaService: ProductMediaService,
    private readonly productCacheService: ProductCacheService
  ) {}

  async create(
    dto: CreateProductDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const id = await this.productMutationService.create(
        dto,
        Number(req.user.id)
      );
      await this.productCacheService.invalidatePublicProductPages();
      return res.status(200).json({ id });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  async update(
    dto: UpdateProductDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.productMutationService.update(dto, Number(req.user.id));
      await this.productCacheService.invalidatePublicProductPages();
      return res.status(200).json({ message: 'Cập nhật thông tin thành công' });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(
        getErrorMessage(error, 'Đã xảy ra lỗi khi cập nhật thông tin sản phẩm')
      );
    }
  }

  async delete(id: number, res: Response): Promise<Response> {
    try {
      await this.productMutationService.delete(id);
      await this.productCacheService.invalidatePublicProductPages();
      return res.status(200).json({ message: 'Đã xóa sản phẩm' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateVariant(dto: UpdateVariantDTO, res: Response): Promise<Response> {
    await this.productMutationService.validateUpdateVariant(dto);
    try {
      await this.productMutationService.updateVariant(dto);
      await this.productCacheService.invalidatePublicProductPages();
      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(
        getErrorMessage(error, 'Đã xảy ra lỗi khi cập nhật phiên bản')
      );
    }
  }

  async updateMainImage(
    productId: number,
    image: string,
    res: Response
  ): Promise<Response> {
    try {
      await this.productMediaService.updateMainImage(productId, image);
      await this.productCacheService.invalidatePublicProductPages();
      return res
        .status(200)
        .json({ message: 'Cập nhật ảnh đại diện thành công' });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(getErrorMessage(error));
    }
  }

  async deleteImage(
    url: string,
    publicId: string,
    res: Response
  ): Promise<Response> {
    try {
      await this.productMediaService.deleteImage(url, publicId);
      await this.productCacheService.invalidatePublicProductPages();
      return res.status(200).json({ message: 'Đã xóa ảnh' });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(getErrorMessage(error));
    }
  }

  async addImage(
    productId: number,
    images: Array<Express.Multer.File>,
    res: Response
  ): Promise<Response> {
    try {
      await this.productMediaService.addImage(productId, images);
      await this.productCacheService.invalidatePublicProductPages();
      return res.status(200).json({ message: 'Thêm ảnh thành công' });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(
        getErrorMessage(error, 'Đã xảy ra lỗi khi thêm ảnh')
      );
    }
  }

  private logError(error: unknown): void {
    this.logger.error(getErrorMessage(error), getErrorStack(error));
  }
}
