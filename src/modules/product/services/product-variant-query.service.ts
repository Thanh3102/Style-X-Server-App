import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { DiscountService } from '../../discount/discount.service';
import { InventoriesService } from '../../inventories/inventories.service';

@Injectable()
export class ProductVariantQueryService {
  private readonly logger = new Logger(ProductVariantQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoriesService: InventoriesService,
    private readonly discountService: DiscountService
  ) {}

  async getProductOptions(productId: number, short?: boolean) {
    const productProperties = await this.prisma.productProperties.findMany({
      where: {
        productId,
      },
      select: {
        id: true,
        name: true,
        position: true,
        values: {
          select: {
            value: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    if (short) {
      return productProperties.map((property) => ({
        id: property.id,
        name: property.name,
        values: property.values.map((value) => value.value),
      }));
    }

    return productProperties.map((property) => ({
      ...property,
      values: property.values.map((value) => value.value),
    }));
  }

  async getProductVariants(productId: number) {
    return this.prisma.productVariants.findMany({
      where: {
        productId,
        void: false,
      },
      select: {
        title: true,
        id: true,
        barCode: true,
        skuCode: true,
        comparePrice: true,
        costPrice: true,
        sellPrice: true,
        unit: true,
        option1: true,
        option2: true,
        option3: true,
        image: true,
        inventories: {
          select: {
            id: true,
            avaiable: true,
            onHand: true,
            onTransaction: true,
            onReceive: true,
            warehouse: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async getProductPublicVariants(productId: number) {
    const productVariants = await this.prisma.productVariants.findMany({
      where: {
        productId,
        void: false,
      },
      select: {
        id: true,
        title: true,
        comparePrice: true,
        sellPrice: true,
        unit: true,
        option1: true,
        option2: true,
        option3: true,
        image: true,
        inventories: {
          select: {
            avaiable: true,
          },
        },
      },
    });
    const activeProductPromotions =
      await this.discountService.getActiveDiscounts({
        mode: ['promotion'],
        type: ['product'],
      });

    const transformedVariants = [];
    for (const variant of productVariants) {
      const { inventories, ...returnData } = variant;
      const avaiable = inventories.reduce(
        (total, inventory) => total + inventory.avaiable,
        0
      );
      const discountInfo = await this.discountService.calcVariantDiscount(
        variant,
        activeProductPromotions
      );
      transformedVariants.push({
        ...returnData,
        ...discountInfo,
        avaiable,
      });
    }
    return transformedVariants;
  }

  async getVariantDetail(variantId: number) {
    try {
      const variant = await this.prisma.productVariants.findUnique({
        where: {
          id: variantId,
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      const variantWarehouses =
        await this.inventoriesService.getVariantWarehouses(variantId);

      return { ...variant, warehouses: variantWarehouses };
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      throw new Error(getErrorMessage(error));
    }
  }

  async findVariantIdByCategoryId(categoryIds: number[]): Promise<number[]> {
    const variants = await this.prisma.productVariants.findMany({
      where: {
        product: {
          productCategories: {
            some: {
              categoryId: {
                in: categoryIds,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return variants.map((variant) => variant.id);
  }
}
