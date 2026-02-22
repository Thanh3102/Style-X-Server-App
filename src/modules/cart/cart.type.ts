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

import { GuestCartService } from './services/guest-cart.service';

export type CartItemData = Awaited<
  ReturnType<typeof GuestCartService.prototype.findGuestCartItems>
>[0];
