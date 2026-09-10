import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { isInteger } from 'src/utils/helper/StringHelper';
import { PublicProductParams } from '../product';
import { ProductCacheService } from './product-cache.service';
import { ProductValidationService } from './product-validation.service';
import { ProductVariantQueryService } from './product-variant-query.service';

@Injectable()
export class ProductPublicQueryService {
  private readonly logger = new Logger(ProductPublicQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productVariantQueryService: ProductVariantQueryService,
    private readonly productValidationService: ProductValidationService,
    private readonly productCacheService: ProductCacheService
  ) {}

  async getProductPublic(
    where: Prisma.ProductWhereInput,
    order: Prisma.ProductOrderByWithRelationInput,
    skip: number | undefined,
    take: number | undefined
  ) {
    try {
      return await this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          image: true,
          createdAt: true,
          updatedAt: true,
          productCategories: {
            select: {
              categoryId: true,
            },
          },
        },
        where,
        orderBy: order,
        take,
        skip,
      });
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      throw new Error(getErrorMessage(error));
    }
  }

  async fetchProductPublic(
    params: PublicProductParams
  ): Promise<PublicProductPage> {
    try {
      const { page: pageParam, limit: limitParam } = params;
      let page = 1;
      let limit = 20;

      if (isInteger(pageParam)) page = parseInt(pageParam);
      if (isInteger(limitParam)) limit = parseInt(limitParam);

      const cachedPage =
        await this.productCacheService.getPublicProductPage<PublicProductPage>(
          page,
          limit
        );
      if (cachedPage) return cachedPage;

      const skip = page === 1 ? 0 : (page - 1) * limit;
      const { where, orderBy } =
        this.transformPublicProductParamsToQuery(params);
      const basicProducts = await this.getProductPublic(
        where,
        orderBy,
        skip,
        limit
      );

      const products = [];
      for (const product of basicProducts) {
        const { productCategories, ...rest } = product;
        const categoryIds = productCategories.map((item) => item.categoryId);
        const options = await this.productVariantQueryService.getProductOptions(
          product.id
        );
        const variants =
          await this.productVariantQueryService.getProductPublicVariants(
            product.id
          );

        products.push({
          ...rest,
          categoryIds,
          options,
          variants,
        });
      }

      const count = await this.prisma.product.count({ where });
      const totalPage = Math.floor(count / limit);
      const responseData = {
        data: products,
        total: count,
        limit,
        currentPage: page,
        lastPage: count % limit == 0 ? totalPage : totalPage + 1,
      };

      await this.productCacheService.setPublicProductPage(
        page,
        limit,
        responseData
      );
      return responseData;
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      throw error;
    }
  }

  async getProductDetailPublic(id: number) {
    const product = await this.prisma.product.findUnique({
      where: {
        id,
        avaiable: true,
      },
      select: {
        id: true,
        name: true,
        skuCode: true,
        comparePrice: true,
        sellPrice: true,
        type: true,
        unit: true,
        description: true,
        shortDescription: true,
        image: true,
        productCategories: true,
      },
    });
    const options = await this.productVariantQueryService.getProductOptions(id);
    const images = await this.getProductImages(id);
    const variants =
      await this.productVariantQueryService.getProductPublicVariants(id);

    return { ...product, options, images, variants };
  }

  async fetchProductDetailPublic(id: number) {
    try {
      await this.productValidationService.checkValidProductId(id);
      const product = await this.getProductDetailPublic(id);
      const sameCategoryBasicProducts = await this.getProductPublic(
        {
          void: false,
          avaiable: true,
          id: { not: id },
          productCategories: {
            some: {
              categoryId: {
                in: product.productCategories.map((item) => item.categoryId),
              },
            },
          },
        },
        {},
        0,
        24
      );

      const sameCategoryProducts = [];
      for (const sameCategoryProduct of sameCategoryBasicProducts) {
        const { productCategories, ...rest } = sameCategoryProduct;
        const categoryIds = productCategories.map((item) => item.categoryId);
        const options = await this.productVariantQueryService.getProductOptions(
          sameCategoryProduct.id
        );
        const variants =
          await this.productVariantQueryService.getProductPublicVariants(
            sameCategoryProduct.id
          );

        sameCategoryProducts.push({
          ...rest,
          categoryIds,
          options,
          variants,
        });
      }

      return {
        ...product,
        sameCategoryProducts,
      };
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      throw error;
    }
  }

  async searchProductPublic(query: string) {
    try {
      const products = await this.getProductPublic(
        { name: { startsWith: query } },
        { name: 'asc' },
        undefined,
        undefined
      );
      const categories = await this.prisma.category.findMany({
        where: {
          title: {
            startsWith: query,
          },
        },
        include: {
          collection: true,
        },
      });

      return { products, categories };
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      throw error;
    }
  }

  private transformPublicProductParamsToQuery(params: PublicProductParams): {
    where: Prisma.ProductWhereInput;
    orderBy: Prisma.ProductOrderByWithRelationInput;
  } {
    const { query, category, slug } = params;
    const where: Prisma.ProductWhereInput = {
      avaiable: true,
      void: false,
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      createdAt: 'desc',
    };

    if (query) {
      where.name = {
        startsWith: query,
      };
    }

    if (slug) {
      where.productCategories = {
        some: {
          category: {
            collection: { slug },
          },
        },
      };
    }

    if (category) {
      where.productCategories ??= { some: { category: {} } };
      where.productCategories.some ??= { category: {} };
      where.productCategories.some.category ??= {};
      where.productCategories.some.category.slug = category;
    }

    return { where, orderBy };
  }

  private async getProductImages(productId: number) {
    return this.prisma.productImages.findMany({
      where: { productId },
      select: {
        url: true,
        publicId: true,
      },
    });
  }
}

type PublicProductPage = {
  data: unknown[];
  total: number;
  limit: number;
  currentPage: number;
  lastPage: number;
};
