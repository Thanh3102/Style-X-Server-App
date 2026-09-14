export enum InventoryTransactionType {
  PRODUCT = 'Sản phẩm',
  ORDER = 'Đơn hàng',
  RECEIVE_INVENTORY = 'Nhập hàng',
  PURCHASE_ORDER = 'Đặt hàng nhập',
}

export enum InventoryTransactionAction {
  INITIAL_SETUP = 'Khởi tạo kho',
  RECEIPT = 'Nhập kho',
  RECEIVE_CANCEL = 'Hủy đơn nhập',
  ADJUST = 'Điều chỉnh số lượng',
  PURCHASE = 'Đặt hàng nhập',
  CREATE_TEMP_ORDER = 'Tạo đơn hàng nháp',
  DELETE_TEMP_ORDER = 'Hủy đơn hàng nháp',
  CANCEL_ORDER = 'Hủy đơn hàng',
  DELIVERY = 'Giao hàng',
  DELIVERY_COMPLETE = 'Hoàn thành giao hàng',
}
