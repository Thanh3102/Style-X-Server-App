import { PaginitionData } from 'src/utils/types';
import { CartCustomerService } from '../cart/services/cart-customer.service';
import { CartGuestService } from '../cart/services/cart-guest.service';
import { OrderQueryService } from './services/order-query.service';

export enum OrderStatus {
  CANCEL = 'Đã hủy',
  PENDING_PAYMENT = 'Đang giao dịch',
  PENDING_PROCESSING = 'Chờ xử lý giao hàng',
  IN_TRANSIT = 'Đang vận chuyển',
  COMPLETE = 'Đã hoàn thành',
}

export enum OrderTransactionStatus {
  PENDING_PAYMENT = 'Chưa thanh toán',
  PAID = 'Đã thanh toán',
}

export enum OrderHistoryType {
  PAYMENT = 'Thanh toán',
  ADJUSTMENT = 'Cập nhật',
  CREATED = 'Khởi tạo',
}

export enum OrderHistoryAction {
  CREATE = 'Khởi tạo',
  CONFIRM_SHIPPING = 'Xác nhận giao hàng',
  CONFIRM_PAYMENT = 'Xác nhận đã giao hàng và nhận tiền',
  CANCEL = 'Hủy đơn hàng',
  DELETE = 'Xóa đơn hàng',
}

export type CreateTempOrderDto = {
  type: 'Guest' | 'Customer';
  cartItemIds: number[];
};

export type CheckoutOrderDto = {
  orderId: string;
  name: string;
  phoneNumber: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  address: string;
  paymentMethod: string;
  receiveName?: string;
  receivePhoneNumber?: string;
  note?: string;
  userType: 'Guest' | 'Customer';
  customerId?: string;
};

export type CustomerCartItem = Awaited<
  ReturnType<typeof CartCustomerService.prototype.getCartItemsData>
>[0];

export type GuestCartItem = Awaited<
  ReturnType<typeof CartGuestService.prototype.getCartItemsData>
>[0];

export type CartItem = CustomerCartItem | GuestCartItem;

export type OrderDetail = Awaited<
  ReturnType<typeof OrderQueryService.prototype.getOrderDetail>
>;

export type OrderListCustomer = {
  id: string;
  name: string;
  email: string;
};

export type FormatOrder = {
  id: string;
  code: string;
  createdAt: Date;
  total: number;
  transactionStatus: string;
  status: string;
  customerId: string;
  customer: null | OrderListCustomer;
  phoneNumber: string;
  name: string;
};

export type FormatOrderDetail = {
  id: string;
  code: string;
  createdAt: Date;
  totalItemBeforeDiscount: number;
  totalItemAfterDiscount: number;
  totalItemDiscountAmount: number;
  totalOrderDiscountAmount: number;
  totalOrderBeforeDiscount: number;
  totalOrderAfterDiscount: number;
  userType: string;
  status: string;
  transactionStatus: string;
  paymentMethod: string;
  email: string;
  name: string;
  phoneNumber: string;
  province: string;
  district: string;
  ward: string;
  address: string;
  note: string | null;
  receiverName: string;
  receiverPhoneNumber: string;
  items: Array<{
    id: number;
    quantity: number;
    priceBeforeDiscount: number;
    totalPriceBeforeDiscount: number;
    priceAfterDiscount: number;
    totalPriceAfterDiscount: number;
    discountAmount: number;
    totalDiscountAmount: number;
    product: {
      id: number;
      name: string;
      image: string;
    };
    variant: {
      id: number;
      title: string;
      image: string;
    };
    applyDiscounts: Array<{
      id: number;
      title: string;
      description: string;
      discountAmount: number;
    }>;
    sources: Array<{
      id: number;
      costPrice: number;
      quantity: number;
      receive: {
        id: number;
        code: string;
      } | null;
      warehouse: {
        id: number;
        name: string;
      };
    }>;
  }>;
  applyDiscounts: Array<{
    id: number;
    title: string;
    description: string;
    discountAmount: number;
  }>;
  histories: Array<{
    id: number;
    action: string;
    type: string;
    reason: string;
    changedEmployee: {
      id: number;
      name: string;
    };
    changedCustomer: {
      id: string;
      name: string;
    };
    createdAt: Date;
  }>;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  void: boolean;
};

export type OrderListResponseData = {
  data: FormatOrder[];
  paginition: PaginitionData;
};

export type ConfirmPaymentReceivedDto = {
  orderId: string;
};

export type PayOsParams = {
  code: string;
  id: string;
  orderCode: string;
  status: string;
  cancel: boolean;
  order: string;
};
