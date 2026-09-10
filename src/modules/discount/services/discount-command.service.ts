import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDiscountDTO, UpdateDiscountDTO } from '../discount.type';

@Injectable()
export class DiscountCommandService {
  constructor(private readonly prisma: PrismaService) {}

  async hasTitleConflict(
    mode: string,
    title: string,
    id?: number
  ): Promise<boolean> {
    const discount = await this.prisma.discount.findFirst({
      where: {
        void: false,
        title,
        mode,
        id: id ? { not: id } : undefined,
      },
      select: {
        id: true,
      },
    });

    return Boolean(discount);
  }

  async getMode(id: number): Promise<string | null> {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      select: { mode: true },
    });
    return discount?.mode ?? null;
  }

  async create(
    dto: CreateDiscountDTO,
    createdUserId: number
  ): Promise<{ id: number }> {
    const discount = await this.prisma.$transaction(async (p) => {
      const createdDiscount = await p.discount.create({
        data: {
          mode: dto.mode,
          active: dto.active,
          description: dto.description,
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
          createdUserId,
          prerequisiteMinItem: dto.prerequisiteMinItem,
          prerequisiteMinItemTotal: dto.prerequisiteMinItemTotal,
          prerequisiteMinTotal: dto.prerequisiteMinTotal,
          usageLimit: dto.usageLimit,
        },
        select: {
          id: true,
        },
      });

      if (dto.entitledCategoriesIds.length > 0) {
        await p.discountCategory.createMany({
          data: dto.entitledCategoriesIds.map((categoryId) => ({
            categoryId,
            discountId: createdDiscount.id,
          })),
        });

        const products = await p.product.findMany({
          where: {
            productCategories: {
              some: {
                categoryId: { in: dto.entitledCategoriesIds },
              },
            },
          },
          select: {
            id: true,
            variants: {
              select: { id: true },
            },
          },
        });

        for (const product of products) {
          await p.discountProduct.create({
            data: {
              discountId: createdDiscount.id,
              productId: product.id,
            },
          });

          await p.discountVariant.createMany({
            data: product.variants.map((variant) => ({
              discountId: createdDiscount.id,
              variantId: variant.id,
            })),
          });
        }
      }

      if (dto.entitledProductIds.length > 0) {
        await p.discountProduct.createMany({
          data: dto.entitledProductIds.map((productId) => ({
            productId,
            discountId: createdDiscount.id,
          })),
        });
      }

      if (dto.entitledVariantIds.length > 0) {
        await p.discountVariant.createMany({
          data: dto.entitledVariantIds.map((variantId) => ({
            variantId,
            discountId: createdDiscount.id,
          })),
        });
      }

      return createdDiscount;
    });

    return discount;
  }

  async update(dto: UpdateDiscountDTO): Promise<void> {
    await this.prisma.$transaction(async (p) => {
      const updateDiscount = await p.discount.update({
        where: {
          id: dto.id,
        },
        data: {
          title: dto.title,
          description: dto.description,
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

      if (dto.entitle === 'all') {
        await p.discountCategory.deleteMany({
          where: { discountId: updateDiscount.id },
        });
        await p.discountProduct.deleteMany({
          where: { discountId: updateDiscount.id },
        });
        await p.discountVariant.deleteMany({
          where: { discountId: updateDiscount.id },
        });
      }

      if (dto.entitle === 'entitledCategory') {
        await this.updateCategoryEntitlements(p, dto);
      }

      if (dto.entitle === 'entitledProduct') {
        await this.updateProductEntitlements(p, dto);
      }
    });
  }

  async updateActive(id: number, active: boolean): Promise<void> {
    await this.prisma.discount.update({
      where: { id },
      data: { active },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.discount.update({
      where: { id },
      data: {
        void: true,
        active: false,
      },
    });
  }

  private async updateCategoryEntitlements(
    prisma: Prisma.TransactionClient,
    dto: UpdateDiscountDTO
  ): Promise<void> {
    const currentCategoryIds = await prisma.discountCategory.findMany({
      where: { discountId: dto.id },
      select: { categoryId: true },
    });
    const currentIds = currentCategoryIds.map((item) => item.categoryId);
    const addedIds = dto.entitledCategoriesIds.filter(
      (id) => !currentIds.includes(id)
    );
    const deletedIds = currentIds.filter(
      (id) => !dto.entitledCategoriesIds.includes(id)
    );

    if (addedIds.length > 0) {
      await prisma.discountCategory.createMany({
        data: addedIds.map((categoryId) => ({
          discountId: dto.id,
          categoryId,
        })),
      });

      const products = await prisma.product.findMany({
        where: {
          productCategories: {
            some: {
              categoryId: { in: addedIds },
            },
          },
        },
        select: {
          id: true,
          variants: {
            select: { id: true },
          },
        },
      });

      for (const product of products) {
        await prisma.discountProduct.create({
          data: {
            discountId: dto.id,
            productId: product.id,
          },
        });
        await prisma.discountVariant.createMany({
          data: product.variants.map((variant) => ({
            discountId: dto.id,
            variantId: variant.id,
          })),
        });
      }
    }

    if (deletedIds.length > 0) {
      await prisma.discountCategory.deleteMany({
        where: {
          discountId: dto.id,
          categoryId: { in: deletedIds },
        },
      });

      const products = await prisma.product.findMany({
        where: {
          productCategories: {
            some: {
              categoryId: { in: deletedIds },
            },
          },
        },
        select: {
          id: true,
          variants: {
            select: { id: true },
          },
        },
      });

      for (const product of products) {
        await prisma.discountProduct.deleteMany({
          where: {
            discountId: dto.id,
            productId: product.id,
          },
        });
        await prisma.discountVariant.deleteMany({
          where: {
            discountId: dto.id,
            variantId: { in: product.variants.map((variant) => variant.id) },
          },
        });
      }
    }
  }

  private async updateProductEntitlements(
    prisma: Prisma.TransactionClient,
    dto: UpdateDiscountDTO
  ): Promise<void> {
    const currentProducts = await prisma.discountProduct.findMany({
      where: { discountId: dto.id },
      select: { productId: true },
    });
    const currentProductIds = currentProducts.map((item) => item.productId);
    const addedProductIds = dto.entitledProductIds.filter(
      (id) => !currentProductIds.includes(id)
    );
    const deletedProductIds = currentProductIds.filter(
      (id) => !dto.entitledProductIds.includes(id)
    );

    if (addedProductIds.length > 0) {
      await prisma.discountProduct.createMany({
        data: addedProductIds.map((productId) => ({
          discountId: dto.id,
          productId,
        })),
      });
    }

    await prisma.discountProduct.deleteMany({
      where: {
        discountId: dto.id,
        productId: { in: deletedProductIds },
      },
    });

    const currentVariants = await prisma.discountVariant.findMany({
      where: { discountId: dto.id },
      select: { variantId: true },
    });
    const currentVariantIds = currentVariants.map((item) => item.variantId);
    const addedVariantIds = dto.entitledVariantIds.filter(
      (id) => !currentVariantIds.includes(id)
    );
    const deletedVariantIds = currentVariantIds.filter(
      (id) => !dto.entitledVariantIds.includes(id)
    );

    if (addedVariantIds.length > 0) {
      await prisma.discountVariant.createMany({
        data: addedVariantIds.map((variantId) => ({
          discountId: dto.id,
          variantId,
        })),
      });
    }

    await prisma.discountVariant.deleteMany({
      where: {
        discountId: dto.id,
        variantId: { in: deletedVariantIds },
      },
    });
  }
}
