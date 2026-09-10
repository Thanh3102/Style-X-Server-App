import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AddItemDto,
  UpdateItemQuantityDto,
  UpdateItemVariantDto,
} from '../cart.dto';
import { CartOperationResult } from './cart-command.types';
import { CartStockPolicy } from './cart-stock-policy.service';

@Injectable()
export class CartCustomerCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockPolicy: CartStockPolicy
  ) {}

  async addItem(
    dto: AddItemDto,
    requestUserId: string
  ): Promise<CartOperationResult> {
    if (requestUserId !== dto.userId) {
      return this.result(403, { message: 'Bạn không quyền thực hiện' });
    }

    const cart = await this.prisma.cart.findUnique({
      where: { customerId: dto.userId },
    });
    if (!cart) throw new Error('Customer cart not found');

    if (
      await this.stockPolicy.isQuantityUnavailable(dto.variantId, dto.quantity)
    ) {
      return this.result(400, {
        message: 'Sản phẩm không còn đủ số lượng.',
      });
    }

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        productId: dto.productId,
        variantId: dto.variantId,
        cartId: cart.id,
      },
    });

    if (existingItem) {
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

    return this.result(200, { message: 'Đã thêm vào giỏ hàng' });
  }

  async updateItemQuantity(
    dto: UpdateItemQuantityDto
  ): Promise<CartOperationResult> {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: dto.itemId },
    });
    if (!item) {
      return this.result(400, {
        message: 'Sản phẩm không còn đủ số lượng. Vui lòng giảm số lượng mua',
      });
    }

    await this.prisma.cartItem.update({
      where: { id: dto.itemId },
      data: { quantity: dto.quantity },
    });

    return this.result(200, { message: 'Đã cập nhật giỏ hàng' });
  }

  async deleteItem(id: number): Promise<CartOperationResult> {
    await this.prisma.cartItem.delete({ where: { id } });
    return this.result(200, { message: 'Đã xóa khỏi giỏ hàng' });
  }

  async updateSelectedItems(
    userId: string,
    itemIds: number[]
  ): Promise<CartOperationResult> {
    const cart = await this.prisma.cart.findUnique({
      where: { customerId: userId },
    });
    if (!cart) return this.result(200, { message: 'No cart found' });

    await this.prisma.cartItem.updateMany({
      where: { cartId: cart.id, id: { in: itemIds } },
      data: { selected: true },
    });
    await this.prisma.cartItem.updateMany({
      where: { cartId: cart.id, id: { notIn: itemIds } },
      data: { selected: false },
    });

    return this.result(200, {});
  }

  async updateItemVariant(
    userId: string,
    dto: UpdateItemVariantDto
  ): Promise<CartOperationResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const cart = await transaction.cart.findUnique({
          where: { customerId: userId },
          include: { items: true },
        });
        if (!cart) return this.result(200, {});

        const changedItem = await transaction.cartItem.findUnique({
          where: { id: dto.itemId },
        });
        if (!changedItem) throw new Error('Cart item not found');

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

          await transaction.cartItem.delete({
            where: { id: dto.itemId },
          });
          await transaction.cartItem.update({
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

        await transaction.cartItem.update({
          where: { id: dto.itemId },
          data: { variantId: dto.newVariantId },
        });
        return this.result(200, { message: 'Đã cập nhật giỏ hàng' });
      },
      { maxWait: 15000, timeout: 15000 }
    );
  }

  private result(
    status: number,
    body: Record<string, unknown>
  ): CartOperationResult {
    return { status, body };
  }
}
