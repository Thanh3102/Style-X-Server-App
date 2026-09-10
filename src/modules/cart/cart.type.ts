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

import { CartGuestQueryService } from './services/cart-guest-query.service';

export type CartItemData = Awaited<
  ReturnType<typeof CartGuestQueryService.prototype.findGuestCartItems>
>[0];
