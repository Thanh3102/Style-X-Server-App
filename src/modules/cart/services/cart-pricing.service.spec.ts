import { DiscountService } from '../../discount/discount.service';
import { CartPricingService } from './cart-pricing.service';

describe('CartPricingService', () => {
  it('prices cart items through the shared discount capability', async () => {
    const pricedCart = { data: [], totalItemAfterDiscount: 0 };
    const discountService = {
      calcOrderDiscount: jest.fn().mockResolvedValue(pricedCart),
    } as unknown as DiscountService;
    const service = new CartPricingService(discountService);

    const result = await service.calculate([]);

    expect(result).toBe(pricedCart);
    expect(discountService.calcOrderDiscount).toHaveBeenCalledWith([]);
  });
});
