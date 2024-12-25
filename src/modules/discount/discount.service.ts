import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ActiveDiscount,
  CreateDiscountDTO,
  UpdateDiscountDTO,
} from './discount.type';
import { Response } from 'express';
import { isInteger } from 'src/utils/helper/StringHelper';
import { QueryParams } from 'src/utils/types';
import { ProductPublic, ProductPublicVariant } from '../product/product';
import { CartItem, Prisma } from '@prisma/client';

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
            createdUserId: req.user.id,
            prerequisiteMinItem: dto.prerequisiteMinItem,
            prerequisiteMinItemTotal: dto.prerequisiteMinItemTotal,
            prerequisiteMinTotal: dto.prerequisiteMinTotal,
            usageLimit: dto.usageLimit,
          },
        });

        // Nếu có danh mục áp dụng
        if (dto.entitledCategoriesIds.length > 0) {
          // Thêm danh mục
          await p.discountCategory.createMany({
            data: dto.entitledCategoriesIds.map((item) => {
              return {
                categoryId: item,
                discountId: createdDiscount.id,
              };
            }),
          });
          // Thêm sản phẩm và phiên bản
          const products = await p.product.findMany({
            where: {
              productCategories: {
                some: {
                  categoryId: {
                    in: dto.entitledCategoriesIds,
                  },
                },
              },
            },
            select: {
              id: true,
              variants: {
                select: {
                  id: true,
                },
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
              data: product.variants.map((item) => {
                return {
                  discountId: createdDiscount.id,
                  variantId: item.id,
                };
              }),
            });
          }
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

      if (discount.void) {
        throw new BadRequestException('Khuyến mại đã bị xóa');
      }

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
    const { page: pg, limit: lim, query, mode, active, type } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    let whereConditon: Prisma.DiscountWhereInput = {
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

    try {
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

      return res.json({
        discounts: discounts,
        paginition: {
          total: totalPage,
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
            where: {
              discountId: updateDiscount.id,
            },
          });

          await p.discountProduct.deleteMany({
            where: {
              discountId: updateDiscount.id,
            },
          });

          await p.discountVariant.deleteMany({
            where: {
              discountId: updateDiscount.id,
            },
          });
        }

        if (dto.entitle === 'entitledCategory') {
          // Cập nhật danh mục áp dụng
          const entitledCategoryIds = await this.getEntitledCategory(
            updateDiscount.id,
          ).then((data) => data.map((item) => item.id));

          const addedEntitledCategoryIds = dto.entitledCategoriesIds.filter(
            (item) => !entitledCategoryIds.includes(item),
          );

          const deletedEntitledCategoryIds = entitledCategoryIds.filter(
            (item) => !dto.entitledCategoriesIds.includes(item),
          );

          if (addedEntitledCategoryIds.length > 0) {
            await p.discountCategory.createMany({
              data: addedEntitledCategoryIds.map((id) => {
                return {
                  discountId: dto.id,
                  categoryId: id,
                };
              }),
            });
            // Thêm sản phẩm và phiên bản

            const products = await p.product.findMany({
              where: {
                productCategories: {
                  some: {
                    categoryId: {
                      in: addedEntitledCategoryIds,
                    },
                  },
                },
              },
              select: {
                id: true,
                variants: {
                  select: {
                    id: true,
                  },
                },
              },
            });

            for (const product of products) {
              await p.discountProduct.create({
                data: {
                  discountId: updateDiscount.id,
                  productId: product.id,
                },
              });

              await p.discountVariant.createMany({
                data: product.variants.map((item) => {
                  return {
                    discountId: updateDiscount.id,
                    variantId: item.id,
                  };
                }),
              });
            }
          }

          if (deletedEntitledCategoryIds.length > 0) {
            await p.discountCategory.deleteMany({
              where: {
                discountId: dto.id,
                categoryId: {
                  in: deletedEntitledCategoryIds,
                },
              },
            });

            // Xóa sản phẩm và phiên bản
            const products = await p.product.findMany({
              where: {
                productCategories: {
                  some: {
                    categoryId: {
                      in: deletedEntitledCategoryIds,
                    },
                  },
                },
              },
              select: {
                id: true,
                variants: {
                  select: {
                    id: true,
                  },
                },
              },
            });

            for (const product of products) {
              await p.discountProduct.deleteMany({
                where: {
                  discountId: updateDiscount.id,
                  productId: product.id,
                },
              });

              await p.discountVariant.deleteMany({
                where: {
                  discountId: updateDiscount.id,
                  variantId: {
                    in: product.variants.map((item) => item.id),
                  },
                },
              });
            }
          }
        }

        if (dto.entitle === 'entitledProduct') {
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
        }

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

  async getActiveDiscounts(options: {
    mode: Array<'coupon' | 'promotion'>;
    type: Array<'product' | 'order'>;
  }) {
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
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  // async calcProductDiscount(
  //   product: ProductPublic,
  //   activeProductPromotions: ActiveDiscount[],
  // ) {
  //   const categoryIds = product.productCategories.map(
  //     (item) => item.categoryId,
  //   );
  //   // Tính giảm giá sản phẩm
  //   // Lọc ra các chương trình áp dụng và không có điều kiện tiên quyết (prerequire)
  //   const affectedPromotion = activeProductPromotions.filter((promotion) => {
  //     if (promotion.prerequisite === 'none') {
  //       switch (promotion.entitle) {
  //         case 'all':
  //           return true;
  //         case 'entitledCategory':
  //           if (categoryIds.some((id) => promotion.categoryIds.includes(id)))
  //             return true;
  //         case 'entitledProduct':
  //           if (promotion.productIds.includes(product.id)) return true;
  //       }
  //     }
  //     return false;
  //   });

  //   const applyPromotions: typeof affectedPromotion = [];
  //   let discountPrice = product.sellPrice;

  //   const combinePromotions = affectedPromotion.filter(
  //     (item) => item.combinesWithProductDiscount,
  //   );
  //   const notCombinePromotions = affectedPromotion.filter(
  //     (item) => !item.combinesWithProductDiscount,
  //   );
  //   const combineValuePromotions = combinePromotions.filter(
  //     (item) => item.valueType === 'value',
  //   );
  //   const combinePercentPromotions = combinePromotions.filter(
  //     (item) => item.valueType === 'percent',
  //   );
  //   const combineFlatPromotions = combinePromotions.filter(
  //     (item) => item.valueType === 'flat',
  //   );

  //   // Tìm giảm giá sản phẩm không kết hợp lớn nhất
  //   if (notCombinePromotions.length > 0) {
  //     let maxNotCombineDiscountValue = 0;
  //     let applyPromotion = null;
  //     for (const promotion of notCombinePromotions) {
  //       switch (promotion.valueType) {
  //         case 'flat':
  //           const flatDiscountValue =
  //             promotion.value < product.sellPrice ? promotion.value : null;
  //           if (
  //             flatDiscountValue &&
  //             flatDiscountValue > maxNotCombineDiscountValue
  //           ) {
  //             maxNotCombineDiscountValue = flatDiscountValue;
  //             applyPromotion = promotion;
  //           }
  //           break;
  //         case 'percent':
  //           let percentDiscountValue =
  //             product.sellPrice * promotion.value * 0.01;
  //           if (promotion.valueLimitAmount) {
  //             percentDiscountValue =
  //               percentDiscountValue <= promotion.valueLimitAmount
  //                 ? percentDiscountValue
  //                 : promotion.valueLimitAmount;
  //           }
  //           if (percentDiscountValue > maxNotCombineDiscountValue) {
  //             (maxNotCombineDiscountValue = percentDiscountValue),
  //               (applyPromotion = promotion);
  //           }
  //           break;
  //         case 'value':
  //           const valueDiscountValue =
  //             product.sellPrice - promotion.value >= 0
  //               ? product.sellPrice - promotion.value
  //               : 0;
  //           if (valueDiscountValue > maxNotCombineDiscountValue) {
  //             maxNotCombineDiscountValue = valueDiscountValue;
  //             applyPromotion = promotion;
  //           }
  //       }
  //     }
  //     // Tính giảm giá mới = Giá tiền sản phẩm - giảm giá lớn nhất có thể
  //     discountPrice -= maxNotCombineDiscountValue;
  //     // Lưu lại chương trình đã áp dụng
  //     applyPromotions.push(applyPromotion);
  //   }

  //   if (combinePromotions.length > 0) {
  //     // Tìm giảm giá đồng giá nhỏ nhất nếu có
  //     const minFlatPromotion = combineFlatPromotions.reduce((min, current) => {
  //       if (min) {
  //         return current.value < min.value ? current : min;
  //       }
  //       return current;
  //     }, null);

  //     if (minFlatPromotion && minFlatPromotion.value < discountPrice) {
  //       discountPrice = minFlatPromotion.value;
  //       applyPromotions.push(minFlatPromotion);
  //     }

  //     // Tính giá trị giảm %
  //     for (const promotion of combinePercentPromotions) {
  //       let amount = discountPrice * promotion.value * 0.01;
  //       if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
  //         amount = promotion.valueLimitAmount;
  //       discountPrice -= amount;
  //       applyPromotions.push(promotion);
  //     }

  //     // Tính giá trị giảm cố định (dừng khi giảm tới âm)
  //     for (const promotion of combineValuePromotions) {
  //       if (discountPrice > 0) {
  //         const newDiscountPrice = discountPrice - promotion.value;
  //         discountPrice = newDiscountPrice >= 0 ? newDiscountPrice : 0;
  //         applyPromotions.push(promotion);
  //       }
  //     }
  //   }
  //   discountPrice = Math.round(discountPrice / 1000) * 1000;

  //   return { discountPrice, applyPromotions };
  // }

  async calcVariantDiscount(
    variant: { sellPrice: number; id: number },
    activeProductPromotions: ActiveDiscount[],
    options?: { withPrerequire?: boolean },
  ) {
    try {
      const { withPrerequire = false } = options ?? {};
      // Tính giảm giá sản phẩm
      // Lọc ra các chương trình áp dụng và không có điều kiện tiên quyết (prerequire)
      const nonePrerequirePromotions = activeProductPromotions.filter(
        (promotion) => {
          // Các giảm giá không yêu cầu về điều kiện
          if (promotion.prerequisite === 'none') {
            // Nếu áp dụng cho tất cả sản phẩm
            if (promotion.entitle === 'all') return true;
            if (promotion.variantIds.includes(variant.id)) return true;
          }
          return false;
        },
      );

      const affectedPromotions = activeProductPromotions.filter((promotion) => {
        if (promotion.entitle === 'all') return true;
        if (promotion.variantIds.includes(variant.id)) return true;
        return false;
      });

      // Các khuyến mại đã áp dụng
      const applyPromotions: Array<
        (typeof nonePrerequirePromotions)[0] & { amount: number }
      > = [];
      // Giá còn lại để thực hiểm giảm giá
      let priceRemain = variant.sellPrice;
      // Giá trị đã giảm
      let discountAmount = 0;
      // Danh sách các khuyến mại không thể kết hợp
      const notCombinePromotions = nonePrerequirePromotions.filter(
        (item) => !item.combinesWithProductDiscount,
      );
      // Danh sách các khuyến mại có thể kết hợp
      const combinePromotions = nonePrerequirePromotions.filter(
        (item) => item.combinesWithProductDiscount,
      );

      // Lọc các khuyến mại có thể kết hợp theo loại
      const combineValuePromotions = combinePromotions.filter(
        (item) => item.valueType === 'value',
      );
      const combinePercentPromotions = combinePromotions.filter(
        (item) => item.valueType === 'percent',
      );
      const combineFlatPromotions = combinePromotions.filter(
        (item) => item.valueType === 'flat',
      );

      // Tìm khuyến mại sản phẩm không kết hợp có giá trị giảm lớn nhất (nếu có)
      if (notCombinePromotions.length > 0) {
        let maxNotCombineDiscountValue = 0;
        let applyPromotion: (typeof activeProductPromotions)[0] | null = null;
        for (const promotion of notCombinePromotions) {
          switch (promotion.valueType) {
            case 'flat':
              const flatDiscountValue =
                promotion.value < variant.sellPrice ? promotion.value : null;
              if (
                flatDiscountValue &&
                flatDiscountValue > maxNotCombineDiscountValue
              ) {
                maxNotCombineDiscountValue = flatDiscountValue;
                applyPromotion = promotion;
              }
              break;
            case 'percent':
              let percentDiscountValue = Math.round(
                variant.sellPrice * promotion.value * 0.01,
              );
              if (promotion.valueLimitAmount) {
                percentDiscountValue =
                  percentDiscountValue <= promotion.valueLimitAmount
                    ? percentDiscountValue
                    : promotion.valueLimitAmount;
              }
              if (percentDiscountValue > maxNotCombineDiscountValue) {
                (maxNotCombineDiscountValue = percentDiscountValue),
                  (applyPromotion = promotion);
              }
              break;
            case 'value':
              const valueDiscountValue =
                variant.sellPrice - promotion.value >= 0
                  ? variant.sellPrice - promotion.value
                  : 0;
              if (valueDiscountValue > maxNotCombineDiscountValue) {
                maxNotCombineDiscountValue = valueDiscountValue;
                applyPromotion = promotion;
              }
              break;
          }
        }
        // Tính giá trị còn lại để giảm
        priceRemain -= maxNotCombineDiscountValue;
        discountAmount += maxNotCombineDiscountValue;
        // Lưu lại chương trình đã áp dụng (Nếu có)
        if (applyPromotion)
          applyPromotions.push({
            ...applyPromotion,
            amount: maxNotCombineDiscountValue,
          });
      }

      /**
       * Quy tắc kết hợp giảm giá sản phẩm kết hợp
       * Chọn ra đồng giá nhỏ nhất
       * Áp dụng tuần tự các giảm giá %
       * Áp dụng tuần tự các giảm giá cố định
       */

      if (combinePromotions.length > 0) {
        // Tìm giảm giá đồng giá nhỏ nhất
        const minFlatPromotion = combineFlatPromotions.reduce(
          (min, current) => {
            if (min) {
              return current.value < min.value ? current : min;
            }
            return current;
          },
          null,
        );

        if (minFlatPromotion && minFlatPromotion.value < priceRemain) {
          priceRemain = minFlatPromotion.value;
          discountAmount += minFlatPromotion.value;
          applyPromotions.push({
            ...minFlatPromotion,
            amount: minFlatPromotion.value,
          });
        }

        // Tính giá trị giảm %
        for (const promotion of combinePercentPromotions) {
          let amount = priceRemain * promotion.value * 0.01;
          if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
            amount = promotion.valueLimitAmount;
          priceRemain -= amount;
          discountAmount += amount;
          applyPromotions.push({ ...promotion, amount });
        }

        // Tính giá trị giảm cố định (dừng khi giảm tới âm)
        for (const promotion of combineValuePromotions) {
          if (priceRemain > 0) {
            const newPriceRemain = priceRemain - promotion.value;
            priceRemain = newPriceRemain >= 0 ? newPriceRemain : 0;
            if (newPriceRemain >= 0) {
              discountAmount += promotion.value;
            }
            applyPromotions.push({ ...promotion, amount: promotion.value });
          }
        }
      }
      priceRemain = Math.round(priceRemain / 1000) * 1000;
      let discountPrice = null;
      let discountPercent = null;
      if (discountAmount !== 0) {
        discountPrice = variant.sellPrice - discountAmount;
        discountPercent = Math.floor(
          ((variant.sellPrice - discountPrice) / variant.sellPrice) * 100,
        );
      }

      return {
        discountPrice,
        discountPercent,
        applyPromotions,
        activePromotions: affectedPromotions,
      };
    } catch (error) {
      console.log(error);
    }
  }
}
