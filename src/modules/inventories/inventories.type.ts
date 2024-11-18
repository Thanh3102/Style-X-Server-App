export type CreateInventoryDTO = {
  variantId: number;
  warehouses: { id: number; name: string; onHand: number }[];
}

export type ChangeOnHandDTO = {
  inventoryId: number;
  onHand: number;
  changeValue: number;
  reason: string;
}
