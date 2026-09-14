import { Injectable } from '@nestjs/common';
import { GuestCart, GuestCartItem } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddGuestItemDto,
  UpdateGuestItemVariantDto,
  UpdateItemQuantityDto,
} from '../cart.dto';
import { CartOperationResult } from './cart-command.types';
import { CartStockPolicy } from './cart-stock-policy.service';

type GuestCartWithItems = GuestCart & { items: GuestCartItem[] };
type GuestCartItemInput = {
  productId: number;
  variantId: number;
  quantity: number;
};

@Injectable()
export class CartGuestCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockPolicy: CartStockPolicy
  ) {}

  async addGuestItem(dto: AddGuestItemDto): Promise<CartOperationResult> {
    let cart: GuestCartWithItems | null = null;
    if (dto.cartId) {
      cart = await this.findGuestCartById(dto.cartId);
    }

    if (!cart) {
      const createdCart = await this.createGuestCart({
        productId: dto.productId,
        variantId: dto.variantId,
        quantity: dto.quantity,
      });
      return this.result(200, { id: createdCart.id });
    }

    if (
      await this.stockPolicy.isQuantityUnavailable(dto.variantId, dto.quantity)
    ) {
      return this.result(400, {
        message: 'Sản phẩm không còn đủ số lượng.',
      });
    }

    const item = await this.prisma.guestCartItem.findFirst({
      where: {
        productId: dto.productId,
        variantId: dto.variantId,
        cartId: cart.id,
      },
    });

    if (item) {
      await this.prisma.guestCartItem.update({
        where: { id: item.id },
        data: { quantity: { increment: dto.quantity } },
      });
    } else {
      await this.prisma.guestCartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          variantId: dto.variantId,
          quantity: dto.quantity,
        },
      });
    }

    await this.prisma.guestCart.update({
      where: { id: cart.id },
      data: { expires: this.expiryDate() },
    });

    return this.result(200, { message: 'Đã thêm vào giỏ hàng' });
  }

  async updateGuestItemQuantity(
    dto: UpdateItemQuantityDto
  ): Promise<CartOperationResult> {
    const item = await this.prisma.guestCartItem.findUnique({
      where: { id: dto.itemId },
    });
    if (!item) throw new Error('Guest cart item not found');

    if (
      await this.stockPolicy.isQuantityUnavailable(item.variantId, dto.quantity)
    ) {
      return this.result(400, {
        message: 'Sản phẩm không còn đủ số lượng. Vui lòng giảm số lượng mua',
      });
    }

    await this.prisma.guestCartItem.update({
      where: { id: dto.itemId },
      data: { quantity: dto.quantity },
    });
    return this.result(200, { message: 'Đã cập nhật giỏ hàng' });
  }

  async deleteGuestItem(id: number): Promise<CartOperationResult> {
    await this.prisma.guestCartItem.delete({ where: { id } });
    return this.result(200, { message: 'Đã xóa khỏi giỏ hàng' });
  }

  async updateGuestSelectedItems(
    cartId: string,
    itemIds: number[]
  ): Promise<CartOperationResult> {
    if (!cartId) return this.result(200, {});

    await this.prisma.guestCartItem.updateMany({
      where: { cartId, id: { in: itemIds } },
      data: { selected: true },
    });
    await this.prisma.guestCartItem.updateMany({
      where: { cartId, id: { notIn: itemIds } },
      data: { selected: false },
    });
    return this.result(200, {});
  }

  async updateGuestItemVariant(
    dto: UpdateGuestItemVariantDto
  ): Promise<CartOperationResult> {
    if (!dto.cartId) return this.result(200, {});

    return this.prisma.$transaction(
      async (transaction) => {
        const cart = await transaction.guestCart.findFirst({
          where: { id: dto.cartId },
          include: { items: true },
        });
        if (!cart) return this.result(200, {});

        const changedItem = await transaction.guestCartItem.findUnique({
          where: { id: dto.itemId },
        });
        if (!changedItem) throw new Error('Guest cart item not found');

        const available = await this.stockPolicy.getAvailable(dto.newVariantId);
        const existingItem = cart.items.find(
          (item) =>
            item.variantId === dto.newVariantId && item.id !== dto.itemId
        );

        if (existingItem) {
          const newQuantity = existingItem.quantity + changedItem.quantity;
          if (newQuantity > available) {
            return this.result(400, {
              message:
                'Số lượng sản phẩm không đủ. Vui lòng giảm số lượng sản phẩm',
            });
          }
          await transaction.guestCartItem.delete({
            where: { id: dto.itemId },
          });
          await transaction.guestCartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
          });
          return this.result(200, { message: 'Đã cập nhật giỏ hàng' });
        }

        if (changedItem.quantity > available) {
          return this.result(400, {
            message: 'Số lượng sản phẩm không đủ. Vui lòng thay đổi số lượng',
          });
        }

        await transaction.guestCartItem.update({
          where: { id: dto.itemId },
          data: { variantId: dto.newVariantId },
        });
        return this.result(200, { message: 'Đã cập nhật giỏ hàng' });
      },
      { maxWait: 15000, timeout: 15000 }
    );
  }

  async createGuestCart(item?: GuestCartItemInput): Promise<GuestCart> {
    const data = item
      ? {
          expires: this.expiryDate().toISOString(),
          items: {
            create: {
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          },
        }
      : { expires: this.expiryDate().toISOString() };

    return this.prisma.guestCart.create({ data });
  }

  async deleteGuestCart(guestCartId: string): Promise<void> {
    await this.prisma.guestCartItem.deleteMany({
      where: { cartId: guestCartId },
    });
    await this.prisma.guestCart.deleteMany({
      where: { id: guestCartId },
    });
  }

  private findGuestCartById(
    guestCartId: string
  ): Promise<GuestCartWithItems | null> {
    return this.prisma.guestCart.findUnique({
      where: { id: guestCartId },
      include: { items: true },
    });
  }

  private expiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date;
  }

  private result(
    status: number,
    body: Record<string, unknown>
  ): CartOperationResult {
    return { status, body };
  }
}
