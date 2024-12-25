export const permissionSections = [
  {
    section: 'Tổng quan',
    permissions: [
      {
        name: 'dashboard_access',
        displayName: 'Xem tổng quan',
      },
    ],
  },
  {
    section: 'Sản phẩm',
    permissions: [
      {
        name: 'product_access',
        displayName: 'Xem danh sách sản phẩm',
      },
      {
        name: 'product_create',
        displayName: 'Thêm sản phẩm',
      },
      {
        name: 'product_update',
        displayName: 'Cập nhật sản phẩm',
      },
      {
        name: 'product_delete',
        displayName: 'Xóa sản phẩm',
      },
    ],
  },
  {
    section: 'Đơn hàng',
    permissions: [
      {
        name: 'order_status_update',
        displayName: 'Cập nhật trạng thái đơn hàng',
      },
      {
        name: 'order_cancel',
        displayName: 'Hủy đơn hàng',
      },
      {
        name: 'order_delete',
        displayName: 'Xóa đơn hàng',
      },
      {
        name: 'order_access',
        displayName: 'Xem danh sách đơn hàng',
      },
    ],
  },
  {
    section: 'Danh mục',
    permissions: [
      {
        name: 'category_access',
        displayName: 'Xem danh sách danh mục',
      },
      {
        name: 'category_create',
        displayName: 'Tạo danh mục và bộ sản phẩm',
      },
      {
        name: 'category_update',
        displayName: 'Cập nhật danh mục và bộ sản phẩm',
      },
      {
        name: 'category_delete',
        displayName: 'Xóa danh mục và bộ sản phẩm',
      },
    ],
  },
  {
    section: 'Nhập hàng',
    permissions: [
      {
        name: 'receive_access',
        displayName: 'Xem danh sách đơn nhập hàng',
      },
      {
        name: 'receive_create',
        displayName: 'Tạo đơn nhập hàng',
      },
      {
        name: 'receive_update',
        displayName: 'Cập nhật đơn nhập hàng',
      },
      {
        name: 'receive_cancel',
        displayName: 'Hủy đơn nhập hàng',
      },
      {
        name: 'receive_delete',
        displayName: 'Xóa đơn nhập hàng',
      },
      {
        name: 'receive_import',
        displayName: 'Nhập hàng',
      },
      {
        name: 'receive_transaction',
        displayName: 'Thanh toán',
      },
    ],
  },
  {
    section: 'Nhà cung cấp',
    permissions: [
      {
        name: 'supplier_access',
        displayName: 'Xem danh sách nhà cung cấp',
      },
      {
        name: 'supplier_create',
        displayName: 'Thêm nhà cung cấp',
      },
      {
        name: 'supplier_update',
        displayName: 'Cập nhật thông tin nhà cung cấp',
      },
      {
        name: 'supplier_delete',
        displayName: 'Xóa nhà cung cấp',
      },
    ],
  },
  {
    section: 'Khách hàng',
    permissions: [
      {
        name: 'customer_access',
        displayName: 'Xem danh sách khách hàng',
      },
    ],
  },
  {
    section: 'Khuyến mại',
    permissions: [
      {
        name: 'discount_access',
        displayName: 'Xem danh sách khuyến mại',
      },
      {
        name: 'discount_create',
        displayName: 'Thêm khuyến mại',
      },
      {
        name: 'discount_update',
        displayName: 'Cập nhật thông tin khuyến mại',
      },
      {
        name: 'discount_delete',
        displayName: 'Xóa khuyến mại',
      },
    ],
  },
  {
    section: 'Nhân viên',
    permissions: [
      {
        name: 'employee_access',
        displayName: 'Xem danh sách nhân viên',
      },
      {
        name: 'employee_create',
        displayName: 'Thêm nhân viên',
      },
      {
        name: 'employee_update',
        displayName: 'Cập nhật thông tin nhân viên',
      },
      {
        name: 'employee_delete',
        displayName: 'Xóa nhân viên',
      },
    ],
  },
  {
    section: 'Vai trò',
    permissions: [
      {
        name: 'role_access',
        displayName: 'Xem danh sách vai trò',
      },
      {
        name: 'role_create',
        displayName: 'Thêm vai trò',
      },
      {
        name: 'role_update',
        displayName: 'Cập nhật thông tin vai trò',
      },
      {
        name: 'role_delete',
        displayName: 'Xóa vai trò',
      },
    ],
  },
  {
    section: 'Kho hàng',
    permissions: [
      {
        name: 'warehouse_access',
        displayName: 'Xem danh sách kho hàng',
      },
      {
        name: 'warehouse_create',
        displayName: 'Thêm kho hàng',
      },
      {
        name: 'warehouse_update',
        displayName: 'Cập nhật thông tin kho hàng',
      },
      // {
      //   name: 'warehouse_delete',
      //   displayName: 'Xóa kho hàng',
      // },
    ],
  },
];
