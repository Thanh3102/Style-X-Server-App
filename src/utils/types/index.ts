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
  WAREHOUSE_IDS = 'warehouseIds',
  REPORT_DATE = 'reportDate',
  REPORT_DATE_MIN = 'reportDateMin',
  REPORT_DATE_MAX = 'reportDateMax',
  SORTBY = 'sortBy',
  ORDER_STATUS = 'orderStatus',
  RECEIVE_STATUS = 'receiveStatus',
  RECEIVE_TRANSACTION_STATUS = 'receiveTransactionStatus',
  IS_EMPLOYED = 'isEmployed',
  ROLE = 'role',
  DIRECTION = 'direction',
  ORDER_BY = 'orderBy',
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

export enum DashboardPermission {
  Access = 'dashboard_access',
}

export enum ProductPermission {
  Access = 'product_access',
  Create = 'product_create',
  Update = 'product_update',
  Delete = 'product_delete',
}

export enum OrderPermission {
  StatusUpdate = 'order_status_update',
  Cancel = 'order_cancel',
  Delete = 'order_delete',
  Access = 'order_access',
}

export enum CategoryPermission {
  Access = 'category_access',
  Create = 'category_create',
  Update = 'category_update',
  Delete = 'category_delete',
}

export enum ReceiveInventoryPermission {
  Access = 'receive_access',
  Create = 'receive_create',
  Update = 'receive_update',
  Cancel = 'receive_cancel',
  Delete = 'receive_delete',
  Import = 'receive_import',
  Transaction = 'receive_transaction',
}

export enum SupplierPermission {
  Access = 'supplier_access',
  Create = 'supplier_create',
  Update = 'supplier_update',
  Delete = 'supplier_delete',
}

export enum CustomerPermission {
  Access = 'customer_access',
}

export enum DiscountPermission {
  Access = 'discount_access',
  Create = 'discount_create',
  Update = 'discount_update',
  Delete = 'discount_delete',
}

export enum EmployeePermission {
  Access = 'employee_access',
  Create = 'employee_create',
  Update = 'employee_update',
  Delete = 'employee_delete',
}

export enum RolePermission {
  Access = 'role_access',
  Create = 'role_create',
  Update = 'role_update',
  Delete = 'role_delete',
}

export enum WarehousePermission {
  Access = 'warehouse_access',
  Create = 'warehouse_create',
  Update = 'warehouse_update',
  // Delete = 'role_delete',
}
