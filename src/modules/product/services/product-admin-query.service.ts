import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { transformCreatedOnParams } from 'src/utils/helper/DateHelper';
import { QueryParams } from 'src/utils/types';
import { ProductInventoryService } from './product-inventory.service';
import { ProductValidationService } from './product-validation.service';
import { ProductVariantQueryService } from './product-variant-query.service';

@Injectable()
export class ProductAdminQueryService {
  private readonly logger = new Logger(ProductAdminQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productInventoryService: ProductInventoryService,
    private readonly productValidationService: ProductValidationService,
    private readonly productVariantQueryService: ProductVariantQueryService
  ) {}

  async get(queryParams: QueryParams) {
    const {
      page: pageParam,
      limit: limitParam,
      query,
      createdOn,
      createdOnMax,
      createdOnMin,
    } = queryParams;

    const page = !isNaN(Number(pageParam)) ? Number(pageParam) : 1;
    const limit = !isNaN(Number(limitParam)) ? Number(limitParam) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const whereCondition: Prisma.ProductWhereInput = {
      void: false,
    };

    if (query) {
      whereCondition.OR = [
        { name: { contains: query.trim() } },
        { skuCode: { contains: query.trim() } },
        { barCode: { contains: query.trim() } },
        {
          variants: {
            some: {
              OR: [{ skuCode: query.trim() }, { barCode: query.trim() }],
            },
          },
        },
      ];
    }

    if (createdOn || createdOnMin || createdOnMax) {
      const { startDate, endDate } = transformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax
      );
      if (startDate || endDate) {
        whereCondition.createdAt = {};
        if (startDate) whereCondition.createdAt.gte = startDate;
        if (endDate) whereCondition.createdAt.lte = endDate;
      }
    }

    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        barCode: true,
        skuCode: true,
        comparePrice: true,
        sellPrice: true,
        costPrice: true,
        image: true,
        type: true,
        vendor: true,
        createdAt: true,
        variants: {
          select: {
            id: true,
            productId: true,
            skuCode: true,
            barCode: true,
            unit: true,
            comparePrice: true,
            sellPrice: true,
            costPrice: true,
            image: true,
            option1: true,
            option2: true,
            option3: true,
            title: true,
            createdAt: true,
          },
          where: {
            void: false,
          },
        },
      },
      where: whereCondition,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip,
    });

    const countProduct = await this.prisma.product.count({
      where: whereCondition,
    });

    const responseProducts = [];
    for (const product of products) {
      const stock = await this.productInventoryService.getInventoryStock(
        product.id
      );
      const variantsWithStock = [];
      for (const variant of product.variants) {
        const variantStock =
          await this.productInventoryService.getVariantInventoryStock(
            variant.id
          );
        variantsWithStock.push({
          ...variant,
          avaiable: variantStock.avaiable,
          onHand: variantStock.onHand,
          onTransaction: variantStock.onTransaction,
          onReceive: variantStock.onReceive,
        });
      }
      responseProducts.push({
        ...product,
        avaiable: stock.avaiable,
        onHand: stock.onHand,
        onTransaction: stock.onTransaction,
        onReceive: stock.onReceive,
        variants: variantsWithStock,
      });
    }

    const totalPage = Math.floor(countProduct / limit);
    return {
      products: responseProducts,
      paginition: {
        total: countProduct % limit == 0 ? totalPage : totalPage + 1,
        count: countProduct,
        page,
        limit,
      },
    };
  }

  async getVariants(queryParams: QueryParams) {
    const { page: pageParam, limit: limitParam, query } = queryParams;

    const page = !isNaN(Number(pageParam)) ? Number(pageParam) : 1;
    const limit = !isNaN(Number(limitParam)) ? Number(limitParam) : 10;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const whereCondition: Prisma.ProductVariantsWhereInput = {
      void: false,
    };

    if (query) {
      whereCondition.OR = [
        { product: { name: { contains: query } } },
        { title: { contains: query } },
        { skuCode: { contains: query } },
        { barCode: { contains: query } },
      ];
    }

    const variants = await this.prisma.productVariants.findMany({
      select: {
        id: true,
        skuCode: true,
        barCode: true,
        unit: true,
        comparePrice: true,
        sellPrice: true,
        costPrice: true,
        image: true,
        option1: true,
        option2: true,
        option3: true,
        title: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            barCode: true,
            skuCode: true,
            comparePrice: true,
            sellPrice: true,
            costPrice: true,
            image: true,
            createdAt: true,
          },
        },
      },
      where: whereCondition,
      orderBy: {
        createdAt: 'desc',
        productId: 'desc',
      },
      take: limit,
      skip,
    });

    const countVariants = await this.prisma.productVariants.count({
      where: whereCondition,
    });

    const responseVariants = [];
    for (const variant of variants) {
      const stock = await this.productInventoryService.getVariantInventoryStock(
        variant.id
      );
      responseVariants.push({
        ...variant,
        avaiable: stock.avaiable,
        onHand: stock.onHand,
        onTransaction: stock.onTransaction,
        onReceive: stock.onReceive,
      });
    }

    const totalPage = Math.floor(countVariants / limit);
    return {
      variants: responseVariants,
      paginition: {
        total: countVariants % limit == 0 ? totalPage : totalPage + 1,
        count: countVariants,
        page,
        limit,
      },
    };
  }

  async getDetail(id: number) {
    try {
      await this.productValidationService.checkValidProductId(id);
      const product = await this.prisma.product.findUnique({
        where: { id },
        select: {
          void: true,
          id: true,
          name: true,
          barCode: true,
          skuCode: true,
          avaiable: true,
          comparePrice: true,
          costPrice: true,
          sellPrice: true,
          type: true,
          unit: true,
          description: true,
          shortDescription: true,
          image: true,
          vendor: true,
        },
      });

      const options = await this.productVariantQueryService.getProductOptions(
        product.id
      );
      const images = await this.getProductImages(product.id);
      const variants = await this.productVariantQueryService.getProductVariants(
        product.id
      );
      const categories = await this.getProductCategories(product.id);
      const tags = await this.getProductTags(product.id);

      return {
        ...product,
        images,
        variants,
        options,
        categories,
        tags,
      };
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      throw error;
    }
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

  private async getProductCategories(productId: number) {
    const productCategories = await this.prisma.productCategory.findMany({
      where: { productId },
      select: {
        category: {
          select: {
            id: true,
            title: true,
            collection: true,
          },
        },
      },
    });

    return productCategories.map((productCategory) => ({
      id: productCategory.category.id,
      title: productCategory.category.title,
      collection: productCategory.category.collection,
    }));
  }

  private async getProductTags(productId: number): Promise<string[]> {
    const productTags = await this.prisma.productTag.findMany({
      where: { productId },
      select: {
        tags: {
          select: {
            name: true,
          },
        },
      },
    });

    return productTags.map((productTag) => productTag.tags.name);
  }
}
