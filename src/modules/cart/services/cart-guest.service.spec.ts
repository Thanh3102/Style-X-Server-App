import { Response } from 'express';
import { CartGuestCommandService } from './cart-guest-command.service';
import { CartGuestQueryService } from './cart-guest-query.service';
import { CartGuestService } from './cart-guest.service';
import { CartPricingService } from './cart-pricing.service';

describe('CartGuestService', () => {
  it('creates a guest cart when the requested cart does not exist', async () => {
    const command = {
      createGuestCart: jest.fn().mockResolvedValue({ id: 'guest-1' }),
    } as unknown as CartGuestCommandService;
    const query = {
      findGuestCartById: jest.fn().mockResolvedValue(null),
    } as unknown as CartGuestQueryService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new CartGuestService(
      query,
      command,
      {} as CartPricingService
    );

    await service.getGuestItems('missing', response);

    expect(command.createGuestCart).toHaveBeenCalledWith();
    expect(response.json).toHaveBeenCalledWith({ id: 'guest-1', data: [] });
  });
});
