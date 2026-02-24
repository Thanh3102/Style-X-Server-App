import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductQueryService } from '../../product/services/product-query.service';
import { ProductInventoryService } from '../../product/services/product-inventory.service';
import { DiscountService } from '../../discount/discount.service';
import { AddItemDto, CartItemData, UpdateItemQuantityDto } from '../cart.type';
import { ActiveDiscount } from '../../discount/discount.type';
import { Response } from 'express';
import { Cart, CartItem } from '@prisma/client';
import { CartGuestService } from './cart-guest.service';
import { PrismaTransactionObject } from 'src/prisma/prisma.types';

@Injectable()
export class CartCustomerService {
  constructor(
    private prisma: PrismaService,
    private productQueryService: ProductQueryService,
    private productInventoryService: ProductInventoryService,
    private discountService: DiscountService,
    private guestCartService: CartGuestService
  ) {}

  async getItems(req, res: Response): Promise<Response> {
    const userId = req.user.id;
    try {
      const cart = await this.prisma.cart.findUnique({
        where: {
          customerId: userId,
        },
      });
      const items = await this.findCartItems(cart.id);
      const {
        finalItems,
        applyOrderPromotions,
        totalItemBeforeDiscount,
        totalItemAfterDiscount,
        totalItemDiscountAmount,
        totalOrderBeforeDiscount,
        totalOrderAfterDiscount,
        totalOrderDiscountAmount,
      } = await this.discountService.calcOrderDiscount(items);

      return res.status(200).json({
        data: finalItems,
        applyOrderPromotions,
        totalItemBeforeDiscount,
        totalItemAfterDiscount,
        totalItemDiscountAmount,
        totalOrderBeforeDiscount,
        totalOrderAfterDiscount,
        totalOrderDiscountAmount,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getCartItemsData(prisma: PrismaTransactionObject, ids: number[]) {
    const items = await prisma.cartItem.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        variant: {
          select: {
            id: true,
            sellPrice: true,
            costPrice: true,
            title: true,
            inventories: {
              select: {
                avaiable: true,
              },
            },
          },
        },
        quantity: true,
      },
    });
    return items;
  }

  async addItem(dto: AddItemDto, req, res: Response): Promise<Response> {
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
      if (await this.checkItemQuantityAvaiable(dto.variantId, dto.quantity)) {
        return res.status(400).json({
          message: 'Sản phẩm không còn đủ số lượng.',
        });
      }
      // Kiểm tra đã có sản phẩm này trong giỏ hàng chưa
      if (await this.checkItemInCart(dto.productId, dto.variantId, cart.id)) {
        await this.prisma.cartItem.updateMany({
          where: {
            productId: dto.productId,
            variantId: dto.variantId,
            cartId: cart.id,
          },
          data: {
            quantity: {
              increment: dto.quantity,
            },
          },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            productId: dto.productId,
            variantId: dto.variantId,
            cartId: cart.id,
            quantity: dto.quantity,
          },
        });
      }
      return res.status(200).json({ message: 'Đã thêm vào giỏ hàng' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateItemQuantity(
    dto: UpdateItemQuantityDto,
    res: Response
  ): Promise<Response> {
    try {
      // Kiểm tra số lượng tồn kho
      if (!(await this.checkItemInCartById(dto.itemId))) {
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

  async deleteItem(id: number, res: Response): Promise<Response> {
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

  async updateItemVariant(
    itemId: number,
    newVariantId: number,
    req,
    res: Response
  ) {
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
            await this.productInventoryService.getVariantInventoryStock(
              newVariantId
            );

          // Kiểm tra phiên bản mới chọn đã có trong giỏ chưa
          const findItem = cart.items.find(
            (item) => item.variantId === newVariantId && item.id !== itemId
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
        { maxWait: 15000, timeout: 15000 }
      );
      return res.status(200).json({ message: 'Đã cập nhật giỏ hàng' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({});
    }
  }

  async syncCart(
    guestCartId: string | null,
    req,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.user.id;
      const userCart = await this.findUserCartById(userId);
      const guestCart =
        await this.guestCartService.findGuestCartById(guestCartId);
      // Nếu cartId từ client không tồn tại - Return
      if (!guestCart) {
        return res.status(200).json({ success: true });
      }
      // Nếu người dùng chưa có cart thì chuyển item từ guest -> user cart
      if (!userCart) {
        await this.createCartFromGuestCart(guestCart, userId);
        return res.status(200).json({ success: true });
      }
      // Đồng bộ item trong giỏ hàng
      await this.syncCartItemFromGuestCart(guestCart, userCart);
      // Xóa giỏ hàng khách vãng lai
      await this.guestCartService.deleteGuestCart(guestCart.id);

      return res.status(200).json({ success: true });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, error: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async createCartFromGuestCart(guestCart, userId): Promise<void> {
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
  }

  async syncCartItemFromGuestCart(guestCart, userCart): Promise<void> {
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
  }

  // Helpers

  async findUserCartById(
    userId: string
  ): Promise<Cart & { items: CartItem[] }> {
    return await this.prisma.cart.findUnique({
      where: {
        customerId: userId,
      },
      include: {
        items: true,
      },
    });
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
      const options = await this.productQueryService.getProductOptions(
        item.product.id
      );
      const { avaiable } =
        await this.productInventoryService.getVariantInventoryStock(
          item.variant.id
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

  async checkItemQuantityAvaiable(
    variantId: number,
    quantity: number
  ): Promise<boolean> {
    const { avaiable } =
      await this.productInventoryService.getVariantInventoryStock(variantId);
    return quantity > avaiable;
  }

  async checkItemInCart(
    productId: number,
    variantId: number,
    cartId: number
  ): Promise<boolean> {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        productId: productId,
        variantId: variantId,
        cartId: cartId,
      },
    });
    return item ? true : false;
  }

  async checkItemInCartById(itemId: number): Promise<boolean> {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
      },
    });
    return item ? true : false;
  }

  async calcItemDiscount(
    item: CartItemData,
    totalPriceBeforeDiscount: number,
    activeProductPromotions: ActiveDiscount[]
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
        (item) => !item.combinesWithProductDiscount
      );
      // Danh sách các khuyến mại có thể kết hợp
      const combinePromotions = affectedPromotions.filter(
        (item) => item.combinesWithProductDiscount
      );

      // Lọc các khuyến mại có thể kết hợp theo loại
      const combineValuePromotions = combinePromotions.filter(
        (item) => item.valueType === 'value'
      );
      const combinePercentPromotions = combinePromotions.filter(
        (item) => item.valueType === 'percent'
      );
      const combineFlatPromotions = combinePromotions.filter(
        (item) => item.valueType === 'flat'
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
                item.variant.sellPrice * promotion.value * 0.01
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
          null
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
            100
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
}
