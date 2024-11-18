export class CreateInventoryDTO {
  variantId: number;
  warehouses: { id: number; name: string; onHand: number }[];
}

export class ChangeOnHandDTO {
  inventoryId: number;
  onHand: number;
  changeValue: number;
  reason: string;
}
