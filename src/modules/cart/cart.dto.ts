export class AddItemDto {
  productId: number;
  variantId: number;
  quantity: number;
  userId: string;
}

export class UpdateItemQuantityDto {
  itemId: number;
  quantity: number;
}

export class UpdateItemVariantDto {
  itemId: number;
  newVariantId: number;
}

export class UpdateGuestItemVariantDto {
  itemId: number;
  cartId: string | null;
  newVariantId: number;
}

export class AddGuestItemDto {
  productId: number;
  variantId: number;
  quantity: number;
  cartId: string | null;
}

export class SyncCartDto {
  guestCartId: string | null;
}

export class UpdateGuestSelectedItemsDto {
  cartId: string;
  itemIds: number[];
}

export class UpdateSelectedItemsDto {
  itemIds: number[];
}
