import { Response } from 'express';
import { CartCustomerCommandService } from './cart-customer-command.service';
import { CartCustomerQueryService } from './cart-customer-query.service';
import { CartCustomerService } from './cart-customer.service';
import { CartPricingService } from './cart-pricing.service';
import { CartSyncService } from './cart-sync.service';

describe('CartCustomerService', () => {
  it('maps priced customer items to the existing response boundary', async () => {
    const priced = {
      finalItems: [],
      applyOrderPromotions: [],
      totalItemBeforeDiscount: 0,
      totalItemAfterDiscount: 0,
      totalItemDiscountAmount: 0,
      totalOrderBeforeDiscount: 0,
      totalOrderAfterDiscount: 0,
      totalOrderDiscountAmount: 0,
    };
    const query = {
      findUserCartById: jest.fn().mockResolvedValue({ id: 20 }),
      findCartItems: jest.fn().mockResolvedValue([]),
    } as unknown as CartCustomerQueryService;
    const pricing = {
      calculate: jest.fn().mockResolvedValue(priced),
    } as unknown as CartPricingService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new CartCustomerService(
      query,
      {} as CartCustomerCommandService,
      pricing,
      {} as CartSyncService
    );

    await service.getItems('customer-1', response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: [],
      applyOrderPromotions: [],
      totalItemBeforeDiscount: 0,
      totalItemAfterDiscount: 0,
      totalItemDiscountAmount: 0,
      totalOrderBeforeDiscount: 0,
      totalOrderAfterDiscount: 0,
      totalOrderDiscountAmount: 0,
    });
  });
});
