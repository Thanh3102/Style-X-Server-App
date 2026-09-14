import { Injectable } from '@nestjs/common';
import {
  FormatOrder,
  FormatOrderDetail,
  OrderDetail,
  OrderListResponseData,
} from '../order.type';

type OrderListRecord = {
  id: string;
  code: string;
  customer: FormatOrder['customer'];
  createdAt: Date;
  status: string;
  transactionStatus: string;
  totalOrderAfterDiscount: number;
  customerId: string | null;
  phoneNumber: string;
  name: string;
};

@Injectable()
export class OrderResponseMapper {
  toListResponse(
    orders: OrderListRecord[],
    paginition: OrderListResponseData['paginition']
  ): OrderListResponseData {
    const data: FormatOrder[] = orders.map((order) => ({
      id: order.id,
      code: order.code,
      customer: order.customer,
      createdAt: order.createdAt,
      status: order.status,
      transactionStatus: order.transactionStatus,
      total: order.totalOrderAfterDiscount,
      customerId: order.customerId,
      phoneNumber: order.phoneNumber,
      name: order.name,
    }));

    return { data, paginition };
  }

  toDetailResponse(order: OrderDetail): FormatOrderDetail {
    return {
      id: order.id,
      void: order.void,
      code: order.code,
      createdAt: order.createdAt,
      totalItemBeforeDiscount: order.totalItemBeforeDiscount,
      totalItemAfterDiscount: order.totalItemAfterDiscount,
      totalItemDiscountAmount: order.totalItemDiscountAmount,
      totalOrderDiscountAmount: order.totalOrderDiscountAmount,
      totalOrderBeforeDiscount: order.totalOrderBeforeDiscount,
      totalOrderAfterDiscount: order.totalOrderAfterDiscount,
      userType: order.userType,
      status: order.status,
      transactionStatus: order.transactionStatus,
      paymentMethod: order.paymentMethod,
      email: order.email,
      name: order.name,
      phoneNumber: order.phoneNumber,
      province: order.province,
      district: order.district,
      ward: order.ward,
      address: order.address,
      note: order.note,
      receiverName: order.receiverName,
      receiverPhoneNumber: order.receiverPhoneNumber,
      items: order.items.map((item) => ({
        ...item,
        applyDiscounts: item.applyDiscounts.map((discount) => ({
          id: discount.discount.id,
          title: discount.discount.title,
          description: discount.discount.description,
          discountAmount: discount.discountAmount,
        })),
      })),
      applyDiscounts: order.applyDiscounts.map((discount) => ({
        id: discount.id,
        title: discount.discount.title,
        description: discount.discount.description,
        discountAmount: discount.discountAmount,
      })),
      histories: order.history,
      customer: order.customer,
    };
  }
}
