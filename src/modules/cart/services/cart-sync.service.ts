import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CartCustomerQueryService,
  CustomerCartWithItems,
} from './cart-customer-query.service';
import { CartGuestCommandService } from './cart-guest-command.service';
import {
  CartGuestQueryService,
  GuestCartWithItems,
} from './cart-guest-query.service';

@Injectable()
export class CartSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerQuery: CartCustomerQueryService,
    private readonly guestQuery: CartGuestQueryService,
    private readonly guestCommand: CartGuestCommandService
  ) {}

  async syncCart(
    userId: string,
    guestCartId: string | null
  ): Promise<{ success: true }> {
    if (!guestCartId) return { success: true };

    const userCart = await this.customerQuery.findUserCartById(userId);
    const guestCart = await this.guestQuery.findGuestCartById(guestCartId);

    if (!guestCart) return { success: true };

    if (!userCart) {
      await this.createCartFromGuestCart(guestCart, userId);
      return { success: true };
    }

    await this.syncCartItemFromGuestCart(guestCart, userCart);
    await this.guestCommand.deleteGuestCart(guestCart.id);

    return { success: true };
  }

  private async createCartFromGuestCart(
    guestCart: GuestCartWithItems,
    userId: string
  ): Promise<void> {
    await this.prisma.cart.create({
      data: {
        customerId: userId,
        items: {
          createMany: {
            data: guestCart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          },
        },
      },
    });
  }

  private async syncCartItemFromGuestCart(
    guestCart: GuestCartWithItems,
    userCart: CustomerCartWithItems
  ): Promise<void> {
    for (const guestItem of guestCart.items) {
      const existingItem = userCart.items.find(
        (item) => item.variantId === guestItem.variantId
      );

      if (existingItem) {
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: guestItem.quantity },
        });
      } else {
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
}
