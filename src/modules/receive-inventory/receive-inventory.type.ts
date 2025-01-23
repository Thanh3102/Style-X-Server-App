export enum ReceiveInventoryTransaction {
  UN_PAID = 'Chưa thanh toán',
  PARTIALLY_PAID = 'Thanh toán một phần',
  PAID = 'Đã thanh toán',
}

export enum ReceiveInventoryStatus {
  NOT_RECEIVED = 'Chưa nhập hàng',
  PARTIALLY_RECEIVED = 'Nhập một phần',
  RECEIVED = 'Đã nhập hàng',
  CANCEL = 'Hủy đơn',
}

export enum ReceiveHistoryType {
  RECEIVE = 'Đơn nhập',
  PAID = 'Thanh toán',
}

export enum ReceiveHistoryAction {
  CREATED = 'Khởi tạo',
  RECEIVED = 'Nhập hàng',
  CANCELLED = 'Hủy đơn',
  PAID = 'Thanh toán',
  UPDATE = "Cập nhật thông tin",
  DELETE = "Xóa đơn"
}

export type CreateReceiveInventoryDTO = {
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
};

export type ImportItemDTO = {
  receiveId: number;
  warehouseId: number;
  importItems: {
    itemId: number;
    variantId: number;
    importQuantity: number;
  }[];
};

export type ProcessPaymentDTO = {
  receiveId: number;
  transactionDate: Date;
  transactionAmount: number;
  transactionMethod: string;
};

export type UpdateReceiveInventoryDTO = {
  receiveId: number;
  code: string;
  expectedOn: Date;
  note: string;
  deleteTags: string[];
  addTags: string[];
}

export type CancelReceiveInventoryDTO = {
  receiveId: number;
  returnItem: boolean;
}
