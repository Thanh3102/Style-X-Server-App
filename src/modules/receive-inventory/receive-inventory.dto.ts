export class CreateReceiveInventoryDTO {
  code: string;
  expectedOn: Date;
  importAfterCreate: boolean;
  items: Array<{
    discountAmount: number;
    discountType: 'percent' | 'value';
    discountValue: number;
    finalPrice: number;
    finalTotal: number;
    price: number;
    quantity: number;
    total: number;
    totalDiscount: number;
    variantId: number;
  }>;
  landedCosts: Array<{
    name: string;
    price: number;
  }>;
  note: string | undefined;
  supplierId: number;
  tags: string[];
  totalItems: number;
  totalItemsDiscount: number;
  totalItemsPrice: number;
  totalItemsPriceBeforeDiscount: number;
  totalLandedCost: number;
  totalReceipt: number;
  transactionAmount: number;
  transactionDate: Date;
  transactionMethod: string;
  transactionStatus: string;
  warehouseId: number;
}

export class UpdateReceiveInventoryDTO {
  receiveId: number;
  code: string;
  expectedOn: Date;
  note: string;
  deleteTags: string[];
  addTags: string[];
}

export class ImportItemDTO {
  receiveId: number;
  warehouseId: number;
  importItems: {
    itemId: number;
    variantId: number;
    importQuantity: number;
  }[];
}

export class ProcessPaymentDTO {
  receiveId: number;
  transactionDate: Date;
  transactionAmount: number;
  transactionMethod: string;
}

export class CancelReceiveInventoryDTO {
  receiveId: number;
  returnItem: boolean
}
