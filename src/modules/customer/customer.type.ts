import { PaginitionData } from 'src/utils/types';

export type GetCustomerResponse = {
  customers: {
    id: string;
    code: string;
    name: string;
    email: string;
    createdAt: Date;
    numberOfOrder: number;
    totalOrderRevenue: number;
  }[];
  paginition: PaginitionData;
};

export type CustomerDetail = {
  code: string;
  name: string;
  gender: string;
  dob: Date;
  email: string;
  createdAt: Date;
  orders: {
    id: string;
    code: string;
    totalItemAfterDiscount: number;
    province: string;
    district: string;
    ward: string;
    address: string;
    paymentMethod: string;
    status: string;
    transactionStatus: string;
  }[];
};

export type UpdateInfoDto = {
  name: string;
  gender: string;
};

export type ChangePasswordDto = {
  oldPassword: string;
  newPassword: string;
};

export type OrderHistory = {
  orders: Array<{
    id: string;
    code: string;
    totalOrderBeforeDiscount: number;
    totalOrderAfterDiscount: number;
    totalOrderDiscountAmount: number;
    status: string;
    transactionStatus: string;
    items: Array<{
      id: string;
      quantity: number;
      totalPriceBeforeDiscount: number;
      totalDiscountAmount: number;
      priceAfterDiscount: number;
      priceBeforeDiscount: number;
      discountAmount: number;
      product: {
        id: number;
        name: string;
        image: string;
      },
      variant: {
        id: number;
        title: string;
      }
    }>;
  }>;
  paginition: PaginitionData;
};
