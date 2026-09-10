import { ReceiveInventoryMapper } from './receive-inventory-mapper.service';

describe('ReceiveInventoryMapper', () => {
  it('builds the existing list response shape', () => {
    const mapper = new ReceiveInventoryMapper();

    expect(mapper.toListResponse([{ id: 1 }], 3, 2, 20)).toEqual({
      receiveInventory: [{ id: 1 }],
      paginition: {
        total: 1,
        count: 3,
        page: 2,
        limit: 20,
      },
    });
  });
});
