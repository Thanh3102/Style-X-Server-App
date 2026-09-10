import { ActiveDiscount } from '../discount.type';
import { DiscountCalculationService } from './discount-calculation.service';
import { DiscountQueryService } from './discount-query.service';

describe('DiscountCalculationService', () => {
  it('applies a non-combinable percentage promotion to a variant', async () => {
    const service = new DiscountCalculationService({} as DiscountQueryService);
    const promotion = {
      id: 1,
      entitle: 'all',
      prerequisite: 'none',
      valueType: 'percent',
      value: 30,
      valueLimitAmount: null,
      combinesWithProductDiscount: false,
    } as ActiveDiscount;

    const result = await service.calcVariantDiscount(
      { id: 10, sellPrice: 10000 },
      [promotion]
    );

    expect(result).toMatchObject({
      discountPrice: 7000,
      discountPercent: 30,
      activePromotions: [promotion],
    });
    expect(result.applyPromotions).toEqual([
      expect.objectContaining({ id: promotion.id, amount: 3000 }),
    ]);
  });
});
