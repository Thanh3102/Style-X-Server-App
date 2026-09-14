import { Response } from 'express';
import { ReceiveInventoryService } from '../receive-inventory.service';
import { ReceiveInventoryDraftService } from './receive-inventory-draft.service';
import { ReceiveInventoryQueryService } from './receive-inventory-query.service';
import { ReceiveInventoryTransactionService } from './receive-inventory-transaction.service';

describe('ReceiveInventoryService', () => {
  it('keeps the list response boundary in the facade', async () => {
    const result = {
      receiveInventory: [],
      paginition: { total: 0, count: 0, page: 1, limit: 20 },
    };
    const query = {
      get: jest.fn().mockResolvedValue(result),
    } as unknown as ReceiveInventoryQueryService;
    const response = {
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new ReceiveInventoryService(
      query,
      {} as ReceiveInventoryDraftService,
      {} as ReceiveInventoryTransactionService
    );

    await service.get({}, response);

    expect(query.get).toHaveBeenCalledWith({});
    expect(response.json).toHaveBeenCalledWith(result);
  });
});
