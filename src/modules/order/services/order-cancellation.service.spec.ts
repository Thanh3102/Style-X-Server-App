import { PrismaService } from 'src/prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import { OrderCancellationService } from './order-cancellation.service';

describe('OrderCancellationService', () => {
  it('deletes a temporary order inside one transaction', async () => {
    const orderDelete = jest.fn().mockResolvedValue({});
    const transactionClient = {
      order: { delete: orderDelete },
      inventory: { findFirst: jest.fn() },
      discount: { update: jest.fn() },
      receiveItem: { updateMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const orderQuery = {
      getOrderDetail: jest.fn().mockResolvedValue({
        items: [],
        applyVouchers: [],
      }),
    } as unknown as OrderQueryService;
    const service = new OrderCancellationService(prisma, orderQuery);

    await service.cancelTemporaryOrder('order-1');

    expect(orderDelete).toHaveBeenCalledWith({ where: { id: 'order-1' } });
  });
});
