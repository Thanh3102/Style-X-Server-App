import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductQueryService } from '../../product/services/product-query.service';
import { ProductInventoryService } from '../../product/services/product-inventory.service';
import { DiscountService } from '../../discount/discount.service';
import { AddGuestItemDto, UpdateItemQuantityDto } from '../cart.dto';
import { GuestCart, GuestCartItem } from '@prisma/client';
import { Response } from 'express';
import { PrismaTransactionObject } from 'src/prisma/prisma.types';

@Injectable()
export class CartGuestService {
  constructor(
    private prisma: PrismaService,
    private productQueryService: ProductQueryService,
    private productInventoryService: ProductInventoryService,
    private discountService: DiscountService
  ) {}

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
        }

        // Nếu không có tạo cart mới và trả về id
        const createdCart = await this.createGuestCart();
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
      console.log(error);

      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getCartItemsData(prisma: PrismaTransactionObject, ids: number[]) {
    const items = await prisma.guestCartItem.findMany({
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
            costPrice: true,
            sellPrice: true,
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

  async addGuestItem(dto: AddGuestItemDto, res: Response): Promise<Response> {
    try {
      let cart: (GuestCart & { items: GuestCartItem[] }) | null = null;
      if (dto.cartId) {
        cart = await this.findGuestCartById(dto.cartId);
      }
      // Nếu không có cart
      if (!cart) {
        // Tạo giỏ hàng nếu giỏ hàng không tồn tại
        const createdCart = await this.createGuestCart({
          productId: dto.productId,
          variantId: dto.variantId,
          quantity: dto.quantity,
        });
        return res.status(200).json({ id: createdCart.id });
      }
      // Kiểm tra số lượng tồn kho
      const { avaiable } =
        await this.productInventoryService.getVariantInventoryStock(
          dto.variantId
        );
      if (dto.quantity > avaiable) {
        return res.status(400).json({
          message: 'Sản phẩm không còn đủ số lượng.',
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

  async updateGuestItemQuantity(dto: UpdateItemQuantityDto, res: Response) {
    try {
      const item = await this.prisma.guestCartItem.findUnique({
        where: {
          id: dto.itemId,
        },
      });
      const { avaiable } =
        await this.productInventoryService.getVariantInventoryStock(
          item.variantId
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

  async updateGuestSelectedItems(
    cartId: string,
    itemIds: number[],
    res: Response
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

  async updateGuestItemVariant(
    data: {
      itemId: number;
      newVariantId: number;
      cartId: string;
    },
    res: Response
  ) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const { cartId, itemId, newVariantId } = data;
          const cart = await p.guestCart.findFirst({
            where: {
              id: cartId,
            },
            include: {
              items: true,
            },
          });

          if (!cart) return res.status(200).json({});

          const changeItem = await p.guestCartItem.findUnique({
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

            await p.guestCartItem.delete({
              where: {
                id: itemId,
              },
            });

            await p.guestCartItem.update({
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

          await p.guestCartItem.update({
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

  // Helpers

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

  async findGuestCartById(
    guestId: string
  ): Promise<GuestCart & { items: GuestCartItem[] }> {
    return await this.prisma.guestCart.findUnique({
      where: {
        id: guestId ?? undefined,
      },
      include: {
        items: true,
      },
    });
  }

  async createGuestCart(item?: {
    productId: number;
    variantId: number;
    quantity: number;
  }): Promise<GuestCart> {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 15);
    if (item) {
      const createdCart = await this.prisma.guestCart.create({
        data: {
          expires: currentDate.toISOString(),
          items: {
            create: {
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          },
        },
      });

      return createdCart;
    } else {
      const createdCart = await this.prisma.guestCart.create({
        data: {
          expires: currentDate.toISOString(),
        },
      });

      return createdCart;
    }
  }

  async deleteGuestCart(guestCartId: string): Promise<void> {
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
  }
}
