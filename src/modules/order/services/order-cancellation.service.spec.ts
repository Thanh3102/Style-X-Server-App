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

  it('rejects temporary-order cancellation before later mutations when a source inventory is missing', async () => {
    const orderDelete = jest.fn();
    const inventoryUpdate = jest.fn();
    const transactionClient = {
      order: { delete: orderDelete },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: inventoryUpdate,
      },
      discount: { update: jest.fn() },
      receiveItem: { updateMany: jest.fn() },
    };
    const service = new OrderCancellationService(
      {
        $transaction: jest.fn(
          async (
            callback: (client: typeof transactionClient) => Promise<unknown>
          ) => callback(transactionClient)
        ),
      } as unknown as PrismaService,
      {
        getOrderDetail: jest.fn().mockResolvedValue({
          items: [
            {
              variantId: 21,
              variant: { id: 21 },
              sources: [{ warehouseId: 4, quantity: 2 }],
            },
          ],
          applyVouchers: [],
        }),
      } as unknown as OrderQueryService
    );

    await expect(service.cancelTemporaryOrder('order-1')).rejects.toThrow(
      'order-1'
    );
    expect(inventoryUpdate).not.toHaveBeenCalled();
    expect(orderDelete).not.toHaveBeenCalled();
  });

  it('rejects admin cancellation before inventory mutation when a source inventory is missing', async () => {
    const inventoryUpdate = jest.fn();
    const transactionClient = {
      order: {
        update: jest.fn().mockResolvedValue({
          status: 'pending_processing',
          items: [
            {
              variantId: 21,
              sources: [{ warehouseId: 4, quantity: 2 }],
            },
          ],
        }),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: inventoryUpdate,
      },
      receiveItem: { updateMany: jest.fn() },
    };
    const service = new OrderCancellationService(
      {
        $transaction: jest.fn(
          async (
            callback: (client: typeof transactionClient) => Promise<unknown>
          ) => callback(transactionClient)
        ),
      } as unknown as PrismaService,
      {} as OrderQueryService
    );

    await expect(
      service.cancelByAdmin(
        {
          orderId: 'order-1',
          reason: 'Customer request',
          isReStock: true,
        } as never,
        7
      )
    ).rejects.toThrow('order-1');
    expect(inventoryUpdate).not.toHaveBeenCalled();
  });
});
