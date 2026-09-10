import { Injectable } from '@nestjs/common';
import { DiscountService } from '../../discount/discount.service';
import type { DiscountOrderResult } from '../../discount/services/discount-calculation.service';
import type { CartItemData } from '../cart.type';

@Injectable()
export class CartPricingService {
  constructor(private readonly discountService: DiscountService) {}

  calculate(items: CartItemData[]): Promise<DiscountOrderResult> {
    return this.discountService.calcOrderDiscount(items);
  }
}
