import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { isInteger } from 'src/utils/helper/StringHelper';
import { QueryParams } from 'src/utils/types';
import {
  ActiveDiscountOptions,
  ActiveDiscountResult,
  DiscountDetail,
  DiscountListQuery,
  DiscountListResult,
  EntitledCategory,
  EntitledProduct,
  EntitledVariant,
  VoucherResult,
} from '../discount-query.type';

@Injectable()
export class DiscountQueryService {
  private readonly logger = new Logger(DiscountQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  getEntitledProduct = async (
    discountId: number
  ): Promise<EntitledProduct[]> => {
    const discountProductIds = await this.prisma.discountProduct.findMany({
      where: {
        discountId: discountId,
      },
      select: {
        productId: true,
      },
    });

    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        image: true,
      },
      where: {
        id: {
          in: discountProductIds.map((item) => item.productId),
        },
      },
    });

    return products;
  };

  getEntitledVariant = async (
    discountId: number
  ): Promise<EntitledVariant[]> => {
    const discountVariantIds = await this.prisma.discountVariant.findMany({
      where: {
        discountId: discountId,
      },
      select: {
        variantId: true,
      },
    });

    const variants = await this.prisma.productVariants.findMany({
      select: {
        id: true,
        title: true,
        image: true,
        productId: true,
      },
      where: {
        id: {
          in: discountVariantIds.map((item) => item.variantId),
        },
      },
    });

    return variants;
  };

  getEntitledCategory = async (
    discountId: number
  ): Promise<EntitledCategory[]> => {
    const discountCategoryIds = await this.prisma.discountCategory.findMany({
      where: {
        discountId: discountId,
      },
      select: {
        categoryId: true,
      },
    });

    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        title: true,
        collection: true,
      },
      where: {
        id: {
          in: discountCategoryIds.map((item) => item.categoryId),
        },
      },
    });

    return categories;
  };

  async getDetail(id: string): Promise<DiscountDetail> {
    if (!isInteger(id))
      throw new BadRequestException('Mã khuyến mại không hợp lệ');
    const discountId = parseInt(id);

    const discount = await this.prisma.discount.findUnique({
      where: {
        id: discountId,
      },
      include: {
        createdUser: {
          select: {
            name: true,
          },
        },
      },
    });

    if (discount.void) {
      throw new BadRequestException('Khuyến mại đã bị xóa');
    }

    const discountProducts = await this.getEntitledProduct(discountId);
    const discountVariants = await this.getEntitledVariant(discountId);
    const discountCategorys = await this.getEntitledCategory(discountId);

    return {
      ...discount,
      products: discountProducts,
      variants: discountVariants,
      categories: discountCategorys,
    };
  }

  prepareListQuery(queryParams: QueryParams): DiscountListQuery {
    const { page: pg, limit: lim, query, mode, active, type } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const whereConditon: Prisma.DiscountWhereInput = {
      void: false,
    };

    if (query) {
      whereConditon.title = {
        startsWith: query,
      };
    }

    if (mode) {
      whereConditon.mode = mode;
    }

    if (type) {
      whereConditon.type = type;
    }

    if (active) {
      whereConditon.active = active === 'true';
    }

    return { whereConditon, page, limit, skip };
  }

  async get({
    whereConditon,
    page,
    limit,
    skip,
  }: DiscountListQuery): Promise<DiscountListResult> {
    const discounts = await this.prisma.discount.findMany({
      where: whereConditon,
      select: {
        id: true,
        mode: true,
        active: true,
        description: true,
        startOn: true,
        endOn: true,
        createdAt: true,
        usage: true,
        usageLimit: true,
        combinesWithOrderDiscount: true,
        combinesWithProductDiscount: true,
        summary: true,
        title: true,
        type: true,
        void: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: skip,
      take: limit,
    });

    const countTotal = await this.prisma.discount.count({
      where: whereConditon,
    });

    const totalPage = Math.ceil(countTotal / limit);

    return {
      discounts: discounts,
      paginition: {
        total: totalPage,
        count: countTotal,
        page: page,
        limit: limit,
      },
    };
  }

  async getActiveDiscounts(
    options: ActiveDiscountOptions
  ): Promise<ActiveDiscountResult[]> {
    const { mode, type } = options;

    try {
      const discounts = await this.prisma.discount.findMany({
        where: {
          active: true,
          void: false,
          mode: {
            in: mode,
          },
          type: {
            in: type,
          },
          startOn: {
            lte: new Date(),
          },
          OR: [
            {
              endOn: null,
            },
            {
              endOn: {
                gte: new Date(),
              },
            },
          ],
        },
        include: {
          entitleCategories: {
            select: {
              category: {
                select: {
                  id: true,
                },
              },
            },
          },
          entitleProducts: {
            select: {
              product: {
                select: {
                  id: true,
                },
              },
            },
          },
          entitleVariants: {
            select: {
              variant: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      const responseDiscounts = discounts.map((discount) => {
        const { entitleCategories, entitleProducts, entitleVariants, ...rest } =
          discount;

        const productIds = entitleProducts.map((item) => item.product.id);
        const variantIds = entitleVariants.map((item) => item.variant.id);
        const categoryIds = entitleCategories.map((item) => item.category.id);
        return {
          ...rest,
          productIds,
          variantIds,
          categoryIds,
        };
      });

      return responseDiscounts;
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      return [];
    }
  }

  async findVoucher(title: string): Promise<VoucherResult | null> {
    const voucher = await this.prisma.discount.findFirst({
      where: {
        title: title,
        mode: 'coupon',
      },
      include: {
        entitleCategories: true,
        entitleProducts: true,
        entitleVariants: true,
      },
    });

    if (!voucher) return null;

    const formatData = {
      ...voucher,
      entitleCategories: voucher.entitleCategories.map(
        (item) => item.categoryId
      ),

      entitleProducts: voucher.entitleProducts.map((item) => item.productId),
      entitleVariants: voucher.entitleVariants.map((item) => item.variantId),
    };

    return formatData;
  }
}
