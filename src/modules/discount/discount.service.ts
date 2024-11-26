import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiscountDTO, UpdateDiscountDTO } from './discount.type';
import { Response } from 'express';
import { isInteger } from 'src/utils/helper/StringHelper';
import { categories } from 'src/prisma/seed-data/category';
import { QueryParams } from 'src/utils/types';

@Injectable()
export class DiscountService {
  constructor(private prisma: PrismaService) {}

  private getEntitledProduct = async (discountId: number) => {
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

  private getEntitledVariant = async (discountId: number) => {
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

  private getEntitledCategory = async (discountId: number) => {
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
      },
      where: {
        id: {
          in: discountCategoryIds.map((item) => item.categoryId),
        },
      },
    });

    return categories;
  };

  private checkTitleExist = async (
    mode: string,
    title: string,
    res: Response,
    id?: number,
  ) => {
    let isTitleExist = false;
    if (id) {
      const exist = await this.prisma.discount.findFirst({
        where: {
          void: false,
          title: title,
          mode: mode,
          id: {
            not: id,
          },
        },
      });

      if (exist) isTitleExist = true;
    } else {
      const exist = await this.prisma.discount.findFirst({
        where: {
          void: false,
          title: title,
          mode: mode,
        },
      });

      if (exist) isTitleExist = true;
    }
    if (isTitleExist)
      return res.status(400).json({ message: 'Tên khuyến mại đã tồn tại' });
  };

  async create(dto: CreateDiscountDTO, req, res: Response) {
    try {
      // Kiểm tra đã tồn tại
      await this.checkTitleExist(dto.mode, dto.title, res);

      const discount = await this.prisma.$transaction(async (p) => {
        const createdDiscount = await p.discount.create({
          data: {
            mode: dto.mode,
            active: dto.active,
            applyFor: dto.applyFor,
            combinesWithOrderDiscount: dto.combinesWithOrderDiscount,
            combinesWithProductDiscount: dto.combinesWithProductDiscount,
            onePerCustomer: dto.onePerCustomer,
            startOn: dto.startOn,
            endOn: dto.endOn,
            summary: dto.summary,
            entitle: dto.entitle,
            prerequisite: dto.prerequisite,
            title: dto.title,
            type: dto.type,
            value: dto.value,
            valueType: dto.valueType,
            valueLimitAmount: dto.valueLimitAmount,
            createdUserId: req.user.id,
            prerequisiteMinItem: dto.prerequisiteMinItem,
            prerequisiteMinItemTotal: dto.prerequisiteMinItemTotal,
            prerequisiteMinTotal: dto.prerequisiteMinTotal,
            usageLimit: dto.usageLimit,
          },
        });

        // Nếu có danh mục áp dụng
        if (dto.entitledCategoriesIds.length > 0) {
          await p.discountCategory.createMany({
            data: dto.entitledCategoriesIds.map((item) => {
              return {
                categoryId: item,
                discountId: createdDiscount.id,
              };
            }),
          });
        }

        // Nếu có sản phẩm áp dụng
        if (dto.entitledProductIds.length > 0) {
          await p.discountProduct.createMany({
            data: dto.entitledProductIds.map((item) => {
              return {
                productId: item,
                discountId: createdDiscount.id,
              };
            }),
          });
        }

        if (dto.entitledVariantIds.length > 0) {
          await p.discountVariant.createMany({
            data: dto.entitledVariantIds.map((item) => {
              return {
                variantId: item,
                discountId: createdDiscount.id,
              };
            }),
          });
        }

        return createdDiscount;
      });

      return res
        .status(200)
        .json({ id: discount.id, messge: 'Tạo khuyến mại thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getDetail(id: string, res: Response) {
    try {
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

      const discountProducts = await this.getEntitledProduct(discountId);
      const discountVariants = await this.getEntitledVariant(discountId);
      const discountCategorys = await this.getEntitledCategory(discountId);

      return res.json({
        ...discount,
        products: discountProducts,
        variants: discountVariants,
        categories: discountCategorys,
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async get(queryParams: QueryParams, res: Response) {
    const { page: pg, limit: lim, query } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 10;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    let whereConditon = {
      void: false,
    };

    try {
      const discounts = await this.prisma.discount.findMany({
        where: whereConditon,
        select: {
          id: true,
          mode: true,
          active: true,
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

      const totalPage = Math.floor(countTotal / limit);

      return res.json({
        discounts: discounts,
        paginition: {
          total: countTotal % limit == 0 ? totalPage : totalPage + 1,
          count: countTotal,
          page: page,
          limit: limit,
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error);
    }
  }

  async update(dto: UpdateDiscountDTO, req, res: Response) {
    try {
      const discount = await this.prisma.discount.findUnique({
        where: {
          id: dto.id,
        },
      });

      await this.checkTitleExist(discount.mode, dto.title, res, discount.id);

      await this.prisma.$transaction(async (p) => {
        const updateDiscount = await p.discount.update({
          where: {
            id: dto.id,
          },
          data: {
            title: dto.title,
            value: dto.value,
            valueLimitAmount: dto.valueLimitAmount,
            valueType: dto.valueType,
            prerequisite: dto.prerequisite,
            prerequisiteMinTotal: dto.prerequisiteMinTotal,
            prerequisiteMinItem: dto.prerequisiteMinItem,
            prerequisiteMinItemTotal: dto.prerequisiteMinItemTotal,
            usageLimit: dto.usageLimit,
            onePerCustomer: dto.onePerCustomer,
            combinesWithProductDiscount: dto.combinesWithProductDiscount,
            combinesWithOrderDiscount: dto.combinesWithOrderDiscount,
            startOn: dto.startOn,
            endOn: dto.endOn,
            summary: dto.summary,
            entitle: dto.entitle,
            applyFor: dto.applyFor,
          },
          select: {
            id: true,
          },
        });

        // Update entitled categories
        const entitledCategoryIds = await this.getEntitledCategory(
          updateDiscount.id,
        ).then((data) => data.map((item) => item.id));

        const addedEntitledCategoryIds = dto.entitledCategoriesIds.filter(
          (item) => !entitledCategoryIds.includes(item),
        );

        const deletedEntitledCategoryIds = entitledCategoryIds.filter(
          (item) => !dto.entitledCategoriesIds.includes(item),
        );

        if (addedEntitledCategoryIds.length > 0)
          await p.discountCategory.createMany({
            data: addedEntitledCategoryIds.map((id) => {
              return {
                discountId: dto.id,
                categoryId: id,
              };
            }),
          });

        await p.discountCategory.deleteMany({
          where: {
            discountId: dto.id,
            categoryId: {
              in: deletedEntitledCategoryIds,
            },
          },
        });

        // Update entitled products
        const entitledProductIds = await this.getEntitledProduct(
          updateDiscount.id,
        ).then((data) => data.map((item) => item.id));

        const addedEntitledProductIds = dto.entitledProductIds.filter(
          (item) => !entitledProductIds.includes(item),
        );

        const deletedEntitledProductIds = entitledProductIds.filter(
          (item) => !dto.entitledProductIds.includes(item),
        );

        if (addedEntitledProductIds.length > 0) {
          await p.discountProduct.createMany({
            data: addedEntitledProductIds.map((id) => {
              return {
                discountId: dto.id,
                productId: id,
              };
            }),
          });
        }

        await p.discountProduct.deleteMany({
          where: {
            discountId: dto.id,
            productId: {
              in: deletedEntitledProductIds,
            },
          },
        });

        // Update entitled variants
        const entitledVariantIds = await this.getEntitledVariant(
          updateDiscount.id,
        ).then((data) => data.map((item) => item.id));

        const addedEntitledVariantIds = dto.entitledVariantIds.filter(
          (item) => !entitledVariantIds.includes(item),
        );

        const deletedEntitledVariantIds = entitledVariantIds.filter(
          (item) => !dto.entitledVariantIds.includes(item),
        );

        if (addedEntitledVariantIds.length > 0) {
          await p.discountVariant.createMany({
            data: addedEntitledVariantIds.map((id) => {
              return {
                discountId: dto.id,
                variantId: id,
              };
            }),
          });
        }

        await p.discountVariant.deleteMany({
          where: {
            discountId: dto.id,
            variantId: {
              in: deletedEntitledVariantIds,
            },
          },
        });

        return dto.id;
      });

      return res.json({
        message: 'Cập nhật khuyến mại thành công',
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async updateActive(id: number, active: boolean, res: Response) {
    try {
      await this.prisma.discount.update({
        where: {
          id: id,
        },
        data: {
          active: active,
        },
      });
      return res.json({
        message: 'Đã cập nhật trạng thái',
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: error.message,
      });
    }
  }

  async delete(id: number, res: Response) {
    try {
      await this.prisma.discount.update({
        where: { id: id },
        data: {
          void: true,
          active: false,
        },
      });

      return res.json({ message: 'Đã xóa khuyến mại' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: error.message,
      });
    }
  }
}
