import {
  CategoryPermission,
  CustomerPermission,
  DashboardPermission,
  DiscountPermission,
  EmployeePermission,
  OrderPermission,
  ProductPermission,
  ReceiveInventoryPermission,
  RolePermission,
  SupplierPermission,
  WarehousePermission,
} from './permissions';

describe('permissions', () => {
  it('preserves permission enum names and values', () => {
    expect({
      DashboardPermission,
      ProductPermission,
      OrderPermission,
      CategoryPermission,
      ReceiveInventoryPermission,
      SupplierPermission,
      CustomerPermission,
      DiscountPermission,
      EmployeePermission,
      RolePermission,
      WarehousePermission,
    }).toEqual({
      DashboardPermission: { Access: 'dashboard_access' },
      ProductPermission: {
        Access: 'product_access',
        Create: 'product_create',
        Update: 'product_update',
        Delete: 'product_delete',
      },
      OrderPermission: {
        StatusUpdate: 'order_status_update',
        Cancel: 'order_cancel',
        Delete: 'order_delete',
        Access: 'order_access',
      },
      CategoryPermission: {
        Access: 'category_access',
        Create: 'category_create',
        Update: 'category_update',
        Delete: 'category_delete',
      },
      ReceiveInventoryPermission: {
        Access: 'receive_access',
        Create: 'receive_create',
        Update: 'receive_update',
        Cancel: 'receive_cancel',
        Delete: 'receive_delete',
        Import: 'receive_import',
        Transaction: 'receive_transaction',
      },
      SupplierPermission: {
        Access: 'supplier_access',
        Create: 'supplier_create',
        Update: 'supplier_update',
        Delete: 'supplier_delete',
      },
      CustomerPermission: { Access: 'customer_access' },
      DiscountPermission: {
        Access: 'discount_access',
        Create: 'discount_create',
        Update: 'discount_update',
        Delete: 'discount_delete',
      },
      EmployeePermission: {
        Access: 'employee_access',
        Create: 'employee_create',
        Update: 'employee_update',
        Delete: 'employee_delete',
      },
      RolePermission: {
        Access: 'role_access',
        Create: 'role_create',
        Update: 'role_update',
        Delete: 'role_delete',
      },
      WarehousePermission: {
        Access: 'warehouse_access',
        Create: 'warehouse_create',
        Update: 'warehouse_update',
      },
    });
  });
});
