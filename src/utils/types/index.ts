export enum FilterParam {
  CREATED_ON = 'createdOn',
  CREATED_ON_MIN = 'createdOnMin',
  CREATED_ON_MAX = 'createdOnMax',
  PAGE = 'page',
  LIMIT = 'limit',
  QUERY = 'query',
  TAG_TYPE = 'tagType',
  ASSIGN_IDS = 'assignIds',
  ACTIVE = 'active',
  RECEIVE_IDS = 'receiveIds',
  VARIANT_IDS = 'variantIds',
}

export type QueryParams = Partial<Record<FilterParam, string>>;

export enum DateFilterOptionValue {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  DAY_LAST_7 = 'day_last_7',
  DAY_LAST_30 = 'day_last_30',
  LAST_WEEK = 'last_week',
  THIS_WEEK = 'this_week',
  LAST_MONTH = 'last_month',
  THIS_MONTH = 'this_month',
  LAST_YEAR = 'last_year',
  THIS_YEAR = 'this_year',
  OPTION = 'date_option',
}

export enum InventoryTransactionType {
  PRODUCT = 'Sản phẩm',
  SELL = 'Bán hàng',
  RECEIVE_INVENTORY = 'Nhập hàng',
  PURCHASE_ORDER = 'Đặt hàng nhập',
}

export enum InventoryTransactionAction {
  INITIAL_SETUP = 'Khởi tạo kho',
  RECEIPT = 'Nhập kho',
  RECEIVE_CANCEL = 'Hủy đơn nhập',
  ADJUST = 'Điều chỉnh số lượng',
  PURCHASE = 'Đặt hàng nhập',
}
