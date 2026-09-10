import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { QueryParams } from 'src/utils/types/query.types';
import { PublicProductParams } from '../product';
import { CategoryService } from './category.service';
import { CollectionService } from './collection.service';
import { ProductAdminQueryService } from './product-admin-query.service';
import { ProductPublicQueryService } from './product-public-query.service';
import { ProductVariantQueryService } from './product-variant-query.service';

@Injectable()
export class ProductQueryService {
  private readonly logger = new Logger(ProductQueryService.name);

  constructor(
    private readonly productAdminQueryService: ProductAdminQueryService,
    private readonly productPublicQueryService: ProductPublicQueryService,
    private readonly productVariantQueryService: ProductVariantQueryService,
    private readonly categoryService: CategoryService,
    private readonly collectionService: CollectionService
  ) {}

  async get(queryParams: QueryParams, res: Response): Promise<Response> {
    const data = await this.productAdminQueryService.get(queryParams);
    return res.status(200).json(data);
  }

  async getVariants(
    queryParams: QueryParams,
    res: Response
  ): Promise<Response> {
    const data = await this.productAdminQueryService.getVariants(queryParams);
    return res.status(200).json(data);
  }

  async getDetail(id: number, res: Response): Promise<Response> {
    try {
      const data = await this.productAdminQueryService.getDetail(id);
      return res.status(200).json(data);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        error: getErrorMessage(error) || 'Đã xảy ra lỗi',
      });
    }
  }

  getProductPublic(
    where: Prisma.ProductWhereInput,
    order: Prisma.ProductOrderByWithRelationInput,
    skip: number | undefined,
    take: number | undefined
  ) {
    return this.productPublicQueryService.getProductPublic(
      where,
      order,
      skip,
      take
    );
  }

  async fetchProductPublic(
    params: PublicProductParams,
    res: Response
  ): Promise<Response> {
    try {
      const data =
        await this.productPublicQueryService.fetchProductPublic(params);
      return res.status(200).json(data);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  getProductDetailPublic(id: number) {
    return this.productPublicQueryService.getProductDetailPublic(id);
  }

  async fetchProductDetailPublic(id: number, res: Response): Promise<Response> {
    try {
      const data =
        await this.productPublicQueryService.fetchProductDetailPublic(id);
      return res.status(200).json(data);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        error: getErrorMessage(error) || 'Đã xảy ra lỗi',
      });
    }
  }

  async searchProductPublic(query: string, res: Response): Promise<Response> {
    try {
      const data =
        await this.productPublicQueryService.searchProductPublic(query);
      return res.status(200).json(data);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  getProductOptions(productId: number, short?: boolean) {
    return this.productVariantQueryService.getProductOptions(productId, short);
  }

  getProductPublicVariants(productId: number) {
    return this.productVariantQueryService.getProductPublicVariants(productId);
  }

  getVariantDetail(variantId: number) {
    return this.productVariantQueryService.getVariantDetail(variantId);
  }

  findVariantIdByCategoryId(categoryIds: number[]) {
    return this.productVariantQueryService.findVariantIdByCategoryId(
      categoryIds
    );
  }

  getCategories(queryParams: QueryParams) {
    return this.categoryService.getCategories(queryParams);
  }

  async getCollections(res: Response): Promise<Response> {
    try {
      const collections = await this.collectionService.getCollections();
      return res.status(200).json(collections);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  getCollectionDetail(slug: string, res: Response) {
    return this.collectionService
      .getCollectionDetail(slug)
      .then((collection) => res.status(200).json(collection))
      .catch((error: unknown) => {
        this.logError(error);
        return res.status(500).json({ message: 'Đã xảy ra lỗi' });
      });
  }

  private logError(error: unknown): void {
    this.logger.error(getErrorMessage(error), getErrorStack(error));
  }
}
