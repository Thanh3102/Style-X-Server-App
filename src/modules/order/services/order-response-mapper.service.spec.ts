import { OrderResponseMapper } from './order-response-mapper.service';

describe('OrderResponseMapper', () => {
  it('maps order list records to the existing public response', () => {
    const mapper = new OrderResponseMapper();
    const pagination = { count: 1, page: 1, limit: 20, total: 1 };

    expect(
      mapper.toListResponse(
        [
          {
            id: 'order-1',
            code: '#000001',
            customer: null,
            createdAt: new Date('2026-01-01'),
            status: 'pending',
            transactionStatus: 'unpaid',
            totalOrderAfterDiscount: 100,
            customerId: null,
            phoneNumber: '0123',
            name: 'Customer',
          },
        ],
        pagination
      )
    ).toEqual({
      data: [
        {
          id: 'order-1',
          code: '#000001',
          customer: null,
          createdAt: new Date('2026-01-01'),
          status: 'pending',
          transactionStatus: 'unpaid',
          total: 100,
          customerId: null,
          phoneNumber: '0123',
          name: 'Customer',
        },
      ],
      paginition: pagination,
    });
  });
});
