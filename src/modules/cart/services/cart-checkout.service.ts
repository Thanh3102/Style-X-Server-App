import { Injectable } from '@nestjs/common';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { CartCustomerQueryService } from './cart-customer-query.service';
import { CartGuestQueryService } from './cart-guest-query.service';

export type CartCheckoutType = 'Customer' | 'Guest';
export type CustomerCartCheckoutItem = Awaited<
  ReturnType<CartCustomerQueryService['getCartItemsData']>
>[number];
export type GuestCartCheckoutItem = Awaited<
  ReturnType<CartGuestQueryService['getCartItemsData']>
>[number];
export type CartCheckoutItem = CustomerCartCheckoutItem | GuestCartCheckoutItem;

@Injectable()
export class CartCheckoutService {
  constructor(
    private readonly customerQuery: CartCustomerQueryService,
    private readonly guestQuery: CartGuestQueryService
  ) {}

  getCartItemsData(
    prisma: PrismaTransactionClient,
    type: 'Customer',
    ids: number[]
  ): ReturnType<CartCustomerQueryService['getCartItemsData']>;
  getCartItemsData(
    prisma: PrismaTransactionClient,
    type: 'Guest',
    ids: number[]
  ): ReturnType<CartGuestQueryService['getCartItemsData']>;
  getCartItemsData(
    prisma: PrismaTransactionClient,
    type: CartCheckoutType,
    ids: number[]
  ): Promise<CartCheckoutItem[]>;
  async getCartItemsData(
    prisma: PrismaTransactionClient,
    type: CartCheckoutType,
    ids: number[]
  ): Promise<CartCheckoutItem[]> {
    if (type === 'Customer') {
      return this.customerQuery.getCartItemsData(prisma, ids);
    }

    return this.guestQuery.getCartItemsData(prisma, ids);
  }
}
