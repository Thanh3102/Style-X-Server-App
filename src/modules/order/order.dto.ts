export type CheckoutOrderDto = {
  name: string;
  orderId: string;
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

export type ApplyVoucherDto = {
  orderId: string;
  voucherCode: string;
};

export class CreateTempOrderDto {
  type: 'Guest' | 'Customer';
  cartItemIds: number[];
}

export class ConfirmDeliveryDto {
  orderId: string;
  isSendEmail: boolean;
}

export class CancelOrderDto {
  orderId: string;
  isReStock: boolean;
  reason: string;
};

export class ConfirmPaymentReceivedDto {
  orderId: string;
}
