import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddGuestItemDto,
  AddItemDto,
  CartItemData,
  UpdateItemQuantityDto,
} from './cart.type';
import { Response } from 'express';
import { ProductService } from '../product/product.service';
import { DiscountService } from '../discount/discount.service';
import { ActiveDiscount } from '../discount/discount.type';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private productService: ProductService,
    private discountService: DiscountService,
  ) {}

  @Cron('0 0 0 * * *', {
    name: 'deleteExpireGuestCart',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async deleteExpireGuestCart() {
    await this.prisma.$transaction(
      async (p) => {
        await p.guestCartItem.deleteMany({
          where: {
            cart: {
              expires: {
                lt: new Date(),
              },
            },
          },
        });

        await p.guestCart.deleteMany({
          where: {
            expires: {
              lt: new Date(),
            },
          },
        });
      },
      {
        maxWait: 30000,
        timeout: 30000,
      },
    );
  }

  async syncCart(guestCartId: string | null, req, res: Response) {
    try {
      const userId = req.user.id;
      const userCart = await this.prisma.cart.findUnique({
        where: {
          customerId: userId,
        },
        include: {
          items: true,
        },
      });
      const guestCart = await this.prisma.guestCart.findUnique({
        where: {
          id: guestCartId ?? undefined,
        },
        include: {
          items: true,
        },
      });

      // Nếu cartid từ client không tồn tại - Return
      if (!guestCart) {
        return res.status(200).json({ success: true });
      }

      // Nếu người dùng chưa có cart thì chuyển item từ guest -> user cart
      if (!userCart) {
        await this.prisma.cart.create({
          data: {
            customerId: userId,
            items: {
              createMany: {
                data: guestCart.items.map((item) => {
                  return {
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                  };
                }),
              },
            },
          },
        });
        return res.status(200).json({ success: true });
      }

      // Nếu đã có cart thì kiểm tra từng item xem có trong giỏ hàng chưa ?
      // Có thì thay đổi số lượng = ở guest cart, không thì thêm mới
      for (const guestItem of guestCart.items) {
        const findItem = userCart.items.find((item) => {
          if (item.variantId === guestItem.variantId) return true;
          return false;
        });

        // Nếu sản phẩm đã có trong giỏ hàng -> Cập nhật số lượng theo giỏ hàng khách vãng lai
        if (findItem) {
          await this.prisma.cartItem.update({
            where: {
              id: findItem.id,
            },
            data: {
              quantity: guestItem.quantity,
            },
          });
        } else {
          // Nếu không tìm thấy sẽ thêm sản phẩm từ giỏ hàng khách vãng lại vào giỏ hàng khách hàng
          await this.prisma.cartItem.create({
            data: {
              quantity: guestItem.quantity,
              productId: guestItem.productId,
              variantId: guestItem.variantId,
              cartId: userCart.id,
            },
          });
        }
      }

      // Xóa giỏ hàng khách vãng lai
      await this.prisma.guestCartItem.deleteMany({
        where: {
          cartId: guestCartId,
        },
      });

      await this.prisma.guestCart.deleteMany({
        where: {
          id: guestCartId,
        },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, error: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async addItem(dto: AddItemDto, req, res: Response) {
    const requestUserId = req.user.id;
    if (requestUserId !== dto.userId) {
      return res.status(403).json({ message: 'Bạn không quyền thực hiện' });
    }

    try {
      const cart = await this.prisma.cart.findUnique({
        where: {
          customerId: dto.userId,
        },
      });

      // Kiểm tra số lượng tồn kho
      const { avaiable } = await this.productService.getVariantInventoryStock(
        dto.variantId,
      );

      if (dto.quantity > avaiable) {
        return res.status(400).json({
          message: 'Sản phẩm không còn đủ số lượng. Vui lòng giảm số lượng mua',
        });
      }

      // Kiểm tra đã có sản phẩm này trong giỏ hàng chưa
      const item = await this.prisma.cartItem.findFirst({
        where: {
          productId: dto.productId,
          variantId: dto.variantId,
          cartId: cart.id,
        },
      });

      if (!item) {
        await this.prisma.cartItem.create({
          data: {
            productId: dto.productId,
            variantId: dto.variantId,
            cartId: cart.id,
            quantity: dto.quantity,
          },
        });
      } else {
        await this.prisma.cartItem.update({
          where: {
            id: item.id,
          },
          data: {
            quantity: {
              increment: dto.quantity,
            },
          },
        });
      }
      return res.status(200).json({ message: 'Đã thêm vào giỏ hàng' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async addGuestItem(dto: AddGuestItemDto, res: Response) {
    try {
      let cart = null;
      if (dto.cartId) {
        cart = await this.prisma.guestCart.findUnique({
          where: {
            id: dto.cartId,
          },
        });
      }

      // Nếu không có cart
      if (!cart) {
        // Tạo giỏ hàng nếu giỏ hàng không tồn tại

        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 15);
        const createdCart = await this.prisma.guestCart.create({
          data: {
            expires: currentDate.toISOString(),
            items: {
              create: {
                quantity: dto.quantity,
                productId: dto.productId,
                variantId: dto.variantId,
              },
            },
          },
        });

        return res.status(200).json({ id: createdCart.id });
      }

      // Kiểm tra số lượng tồn kho
      const { avaiable } = await this.productService.getVariantInventoryStock(
        dto.variantId,
      );

      if (dto.quantity > avaiable) {
        return res.status(400).json({
          message: 'Sản phẩm không còn đủ số lượng. Vui lòng giảm số lượng mua',
        });
      }

      // Kiểm tra đã có sản phẩm này trong giỏ hàng chưa
      const item = await this.prisma.guestCartItem.findFirst({
        where: {
          productId: dto.productId,
          variantId: dto.variantId,
          cartId: cart.id,
        },
      });

      // Chưa có sẽ thêm / Có sẽ tăng số lượng
      if (!item) {
        await this.prisma.guestCartItem.create({
          data: {
            cartId: cart.id,
            productId: dto.productId,
            variantId: dto.variantId,
            quantity: dto.quantity,
          },
        });
      } else {
        await this.prisma.guestCartItem.update({
          where: {
            id: item.id,
          },
          data: {
            quantity: {
              increment: dto.quantity,
            },
          },
        });
      }

      // Gia hạn thời gian expire
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + 15);
      await this.prisma.guestCart.update({
        where: {
          id: dto.cartId,
        },
        data: {
          expires: currentDate,
        },
      });

      return res.status(200).json({ message: 'Đã thêm vào giỏ hàng' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateItemQuantity(dto: UpdateItemQuantityDto, res: Response) {
    try {
      // Kiểm tra số lượng tồn kho
      const item = await this.prisma.cartItem.findUnique({
        where: {
          id: dto.itemId,
        },
      });
      const { avaiable } = await this.productService.getVariantInventoryStock(
        item.variantId,
      );

      if (dto.quantity > avaiable) {
        return res.status(400).json({
          message: 'Sản phẩm không còn đủ số lượng. Vui lòng giảm số lượng mua',
        });
      }

      await this.prisma.cartItem.update({
        where: {
          id: dto.itemId,
        },
        data: {
          quantity: dto.quantity,
        },
      });

      return res.json({ message: 'Đã cập nhật giỏ hàng' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async deleteItem(id: number, res: Response) {
    try {
      await this.prisma.cartItem.delete({
        where: {
          id: id,
        },
      });

      return res.json({ message: 'Đã xóa khỏi giỏ hàng' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getItems(req, res: Response) {
    const userId = req.user.id;
    try {
      const cart = await this.prisma.cart.findUnique({
        where: {
          customerId: userId,
        },
      });
      const items = await this.findCartItems(cart.id);
      const selectedItems = items.filter((item) => item.selected);
      const activePromotions = await this.discountService.getActiveDiscounts({
        mode: ['promotion'],
        type: ['product'],
      });

      const totalOrderBeforeDiscount = selectedItems.reduce(
        (total, item) => total + item.quantity * item.variant.sellPrice,
        0,
      );

      // Tính giảm giá mỗi sản phẩm
      const calcItemsDiscountPromise = items.map(async (item) => {
        const {
          applyPromotions,
          discountAmount,
          discountPercent,
          discountPrice,
        } = await this.calcItemDiscount(
          item,
          totalOrderBeforeDiscount,
          activePromotions,
        );
        return {
          ...item,
          discountPrice,
          discountPercent,
          discountAmount,
          applyPromotions,
          totalDiscount: discountPrice * item.quantity,
          totalPrice: item.variant.sellPrice * item.quantity,
        };
      });

      const finalItems = await Promise.all(calcItemsDiscountPromise);
      const totalOrderAfterDiscount = finalItems
        .filter((item) => selectedItems.find((i) => i.id === item.id))
        .reduce((total, item) => {
          if (item.totalDiscount) {
            return total + item.totalDiscount;
          }
          return total + item.totalPrice;
        }, 0);
      const totalDiscountAmount = finalItems
        .filter((item) => selectedItems.find((i) => i.id === item.id))
        .reduce((total, item) => total + item.discountAmount, 0);
      return res.status(200).json({
        data: finalItems,
        totalOrderBeforeDiscount,
        totalOrderAfterDiscount,
        totalDiscountAmount,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getGuestItems(cartId: string | null, res: Response) {
    try {
      if (cartId) {
        const cart = await this.prisma.guestCart.findUnique({
          where: {
            id: cartId,
          },
        });

        // Nếu id có tồn tại cart tương ứng
        if (cart) {
          const items = await this.findGuestCartItems(cart.id);
          const selectedItems = items.filter((item) => item.selected);
          const activePromotions =
            await this.discountService.getActiveDiscounts({
              mode: ['promotion'],
              type: ['product'],
            });

          const totalOrderBeforeDiscount = selectedItems.reduce(
            (total, item) => total + item.quantity * item.variant.sellPrice,
            0,
          );

          // Tính giảm giá mỗi sản phẩm
          const calcItemsDiscountPromise = items.map(async (item) => {
            const {
              applyPromotions,
              discountAmount,
              discountPercent,
              discountPrice,
            } = await this.calcItemDiscount(
              item,
              totalOrderBeforeDiscount,
              activePromotions,
            );
            return {
              ...item,
              discountPrice,
              discountPercent,
              discountAmount,
              applyPromotions,
              totalDiscount: discountPrice * item.quantity,
              totalPrice: item.variant.sellPrice * item.quantity,
            };
          });

          const finalItems = await Promise.all(calcItemsDiscountPromise);
          const totalOrderAfterDiscount = finalItems
            .filter((item) => selectedItems.find((i) => i.id === item.id))
            .reduce((total, item) => {
              if (item.totalDiscount) {
                return total + item.totalDiscount;
              }
              return total + item.totalPrice;
            }, 0);
          const totalDiscountAmount = finalItems
            .filter((item) => selectedItems.find((i) => i.id === item.id))
            .reduce((total, item) => total + item.discountAmount, 0);

          // Tính toán đơn hàng (Từ các item đã chọn)

          return res.status(200).json({
            data: finalItems,
            totalOrderBeforeDiscount,
            totalOrderAfterDiscount,
            totalDiscountAmount,
          });
        }

        // Nếu không có tạo cart mới và trả về id
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 15);
        const createdCart = await this.prisma.guestCart.create({
          data: {
            expires: currentDate.toISOString(),
          },
        });
        return res.status(200).json({ id: createdCart.id, data: [] });
      } else {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 15);
        const createdCart = await this.prisma.guestCart.create({
          data: {
            expires: currentDate.toISOString(),
          },
        });
        return res.status(200).json({ id: createdCart.id, data: [] });
      }
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateGuestItemQuantity(dto: UpdateItemQuantityDto, res: Response) {
    try {
      const item = await this.prisma.guestCartItem.findUnique({
        where: {
          id: dto.itemId,
        },
      });
      const { avaiable } = await this.productService.getVariantInventoryStock(
        item.variantId,
      );

      if (dto.quantity > avaiable) {
        return res.status(400).json({
          message: 'Sản phẩm không còn đủ số lượng. Vui lòng giảm số lượng mua',
        });
      }

      await this.prisma.guestCartItem.update({
        where: {
          id: dto.itemId,
        },
        data: {
          quantity: dto.quantity,
        },
      });

      return res.json({ message: 'Đã cập nhật giỏ hàng' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async deleteGuestItem(id: number, res: Response) {
    try {
      await this.prisma.guestCartItem.delete({
        where: {
          id: id,
        },
      });

      return res.json({ message: 'Đã xóa khỏi giỏ hàng' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async findGuestCartItems(cartId: string) {
    const items = await this.prisma.guestCartItem.findMany({
      where: {
        cartId: cartId,
        product: {
          void: false,
          avaiable: true,
        },
        variant: {
          void: false,
        },
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            sellPrice: true,
            unit: true,
            type: true,
          },
        },
        variant: {
          select: {
            id: true,
            sellPrice: true,
            comparePrice: true,
            image: true,
            title: true,
            option1: true,
            option2: true,
            option3: true,
            unit: true,
          },
        },
        quantity: true,
        selected: true,
      },
    });

    const tranformItemsPromise = items.map(async (item) => {
      const options = await this.productService.getProductOptions(
        item.product.id,
      );
      return {
        ...item,
        options,
      };
    });

    const tranformItems = await Promise.all(tranformItemsPromise);

    return tranformItems;
  }

  async findCartItems(cartId: number) {
    const items = await this.prisma.cartItem.findMany({
      where: {
        cartId: cartId,
        product: {
          void: false,
          avaiable: true,
        },
        variant: {
          void: false,
        },
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            sellPrice: true,
            unit: true,
            type: true,
            variants: {
              select: {
                id: true,
                option1: true,
                option2: true,
                option3: true,
              },
            },
          },
        },
        variant: {
          select: {
            id: true,
            sellPrice: true,
            comparePrice: true,
            image: true,
            title: true,
            option1: true,
            option2: true,
            option3: true,
            unit: true,
          },
        },
        quantity: true,
        selected: true,
      },
    });

    const tranformItemsPromise = items.map(async (item) => {
      const options = await this.productService.getProductOptions(
        item.product.id,
      );
      const { avaiable } = await this.productService.getVariantInventoryStock(
        item.variant.id,
      );
      return {
        ...item,
        options,
        avaiable,
      };
    });

    const tranformItems = await Promise.all(tranformItemsPromise);

    return tranformItems;
  }

  async updateGuestSelectedItems(
    cartId: string,
    itemIds: number[],
    res: Response,
  ) {
    if (!cartId) return res.status(200).json({});
    try {
      await this.prisma.guestCartItem.updateMany({
        where: {
          cartId: cartId,
          id: {
            in: itemIds,
          },
        },
        data: {
          selected: true,
        },
      });

      await this.prisma.guestCartItem.updateMany({
        where: {
          cartId: cartId,
          id: {
            notIn: itemIds,
          },
        },
        data: {
          selected: false,
        },
      });

      return res.status(200).json({});
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateSelectedItems(itemIds: number[], req, res: Response) {
    const requestUserId = req.user.id;
    const cart = await this.prisma.cart.findUnique({
      where: {
        customerId: requestUserId,
      },
    });

    if (!cart) return res.status(200).json({ message: 'No cart found' });

    try {
      await this.prisma.cartItem.updateMany({
        where: {
          cartId: cart.id,
          id: {
            in: itemIds,
          },
        },
        data: {
          selected: true,
        },
      });

      await this.prisma.cartItem.updateMany({
        where: {
          cartId: cart.id,
          id: {
            notIn: itemIds,
          },
        },
        data: {
          selected: false,
        },
      });

      return res.status(200).json({});
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async calcItemDiscount(
    item: CartItemData,
    totalPriceBeforeDiscount: number,
    activeProductPromotions: ActiveDiscount[],
  ) {
    try {
      // Tính giảm giá sản phẩm

      // Lọc ra các chương trình áp dụng và không có điều kiện tiên quyết (prerequire)
      // const nonePrerequirePromotions = activeProductPromotions.filter(
      //   (promotion) => {
      //     // Các giảm giá không yêu cầu về điều kiện
      //     if (promotion.prerequisite === 'none') {
      //       // Nếu áp dụng cho tất cả sản phẩm
      //       if (promotion.entitle === 'all') return true;
      //       if (promotion.variantIds.includes(item.variant.id)) return true;
      //     }
      //     return false;
      //   },
      // );

      const affectedPromotions = activeProductPromotions.filter((promotion) => {
        if (promotion.entitle === 'all' && promotion.prerequisite === 'none') {
          return true;
        }

        if (
          promotion.entitle !== 'all' &&
          !promotion.variantIds.includes(item.variant.id)
        ) {
          return false;
        }
        if (promotion.prerequisite !== 'none') {
          switch (promotion.prerequisite) {
            case 'prerequisiteMinTotal':
              if (totalPriceBeforeDiscount < promotion.prerequisiteMinTotal)
                return false;
              break;

            case 'prerequisiteMinItemTotal':
              const totalItemBeforeDiscount =
                item.variant.sellPrice * item.quantity;
              if (totalItemBeforeDiscount < promotion.prerequisiteMinItemTotal)
                return false;
              break;

            case 'prerequisiteMinItem':
              if (item.quantity < promotion.prerequisiteMinItem) return false;
              break;
          }
        }
        return true;
      });

      // Các khuyến mại đã áp dụng
      const applyPromotions: Array<
        (typeof activeProductPromotions)[0] & { amount: number }
      > = [];
      // Giá còn lại để thực hiểm giảm giá
      let priceRemain = item.variant.sellPrice;
      // Giá trị đã giảm
      let discountAmount = 0;
      // Danh sách các khuyến mại không thể kết hợp
      const notCombinePromotions = affectedPromotions.filter(
        (item) => !item.combinesWithProductDiscount,
      );
      // Danh sách các khuyến mại có thể kết hợp
      const combinePromotions = affectedPromotions.filter(
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
                promotion.value < item.variant.sellPrice
                  ? promotion.value
                  : null;
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
                item.variant.sellPrice * promotion.value * 0.01,
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
                item.variant.sellPrice - promotion.value >= 0
                  ? item.variant.sellPrice - promotion.value
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
        discountPrice = item.variant.sellPrice - discountAmount;
        discountPercent = Math.floor(
          ((item.variant.sellPrice - discountPrice) / item.variant.sellPrice) *
            100,
        );
      }

      return {
        discountPrice,
        discountPercent,
        discountAmount,
        applyPromotions,
        // activePromotions: affectedPromotions,
      };
    } catch (error) {
      console.log(error);
    }
  }

  async updateItemVariant(
    itemId: number,
    newVariantId: number,
    req,
    res: Response,
  ) {
    console.log('New variant id', newVariantId);

    try {
      await this.prisma.$transaction(
        async (p) => {
          const requestUserId = req.user.id;
          const cart = await p.cart.findUnique({
            where: {
              customerId: requestUserId,
            },
            include: {
              items: true,
            },
          });

          const changeItem = await p.cartItem.findUnique({
            where: {
              id: itemId,
            },
          });

          const { avaiable: newVariantAvaiable } =
            await this.productService.getVariantInventoryStock(newVariantId);

          // Kiểm tra phiên bản mới chọn đã có trong giỏ chưa
          const findItem = cart.items.find(
            (item) => item.variantId === newVariantId && item.id !== itemId,
          );

          // Nếu đã có một item khác là sản phẩm này thì cộng dồn (Kiểm tra tồn kho trước khi thay đổi)
          if (findItem) {
            const newQuantity = findItem.quantity + changeItem.quantity;
            if (newQuantity > newVariantAvaiable) {
              return res.status(400).json({
                message:
                  'Số lượng sản phẩm không đủ. Vui lòng giảm số lượng sản phẩm',
              });
            }

            await p.cartItem.delete({
              where: {
                id: itemId,
              },
            });

            await p.cartItem.update({
              where: {
                id: findItem.id,
              },
              data: {
                quantity: newQuantity,
              },
            });

            return;
          }

          // Nếu không có sản phẩm khác trùng tùy chọn
          // Kiểm tra phiên bản mới còn đủ số lượng không
          // Thay đổi variantId item sang variant mới
          if (changeItem.quantity > newVariantAvaiable) {
            return res.status(400).json({
              message: 'Số lượng sản phẩm không đủ. Vui lòng thay đổi số lượng',
            });
          }

          await p.cartItem.update({
            where: {
              id: itemId,
            },
            data: {
              variantId: newVariantId,
            },
          });
        },
        { maxWait: 15000, timeout: 15000 },
      );
      return res.status(200).json({ message: 'Đã cập nhật giỏ hàng' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({});
    }
  }
}
