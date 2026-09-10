import { PrismaService } from 'src/prisma/prisma.service';
import { ReceiveInventoryTransactionService } from './receive-inventory-transaction.service';

describe('ReceiveInventoryTransactionService', () => {
  it('records a delete history inside the transaction boundary', async () => {
    const update = jest.fn().mockResolvedValue({});
    const transactionClient = {
      receiveInventory: { update },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new ReceiveInventoryTransactionService(prisma);

    await service.delete(7, 1);

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        void: true,
        receiveHistories: {
          create: {
            action: expect.any(String),
            type: expect.any(String),
            changedUserId: 1,
          },
        },
      },
    });
  });
});
