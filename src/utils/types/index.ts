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
  MODE = 'mode',
  TYPE = 'type',
  RECEIVE_IDS = 'receiveIds',
  VARIANT_IDS = 'variantIds',
  REPORT_DATE = 'reportDate',
  REPORT_DATE_MIN = 'reportDateMin',
  REPORT_DATE_MAX = 'reportDateMax',
  SORTBY = 'sortBy',
  ORDER_STATUS = 'orderStatus',
  RECEIVE_STATUS = 'receiveStatus',
  RECEIVE_TRANSACTION_STATUS = 'receiveTransactionStatus',
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

export type PaginitionData = {
  total: number;
  count: number;
  page: number;
  limit: number;
};
