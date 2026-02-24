import { CartService } from './cart.service';

export type AddItemDto = {
  productId: number;
  variantId: number;
  quantity: number;
  userId: string;
};

export type AddGuestItemDto = {
  productId: number;
  variantId: number;
  quantity: number;
  cartId: string | null;
};

export type UpdateItemQuantityDto = {
  itemId: number;
  quantity: number;
};

import { CartGuestService } from './services/cart-guest.service';

export type CartItemData = Awaited<
  ReturnType<typeof CartGuestService.prototype.findGuestCartItems>
>[0];
