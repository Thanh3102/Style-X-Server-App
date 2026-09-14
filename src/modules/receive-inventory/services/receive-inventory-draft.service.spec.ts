import { PrismaService } from 'src/prisma/prisma.service';
import { ReceiveInventoryDraftService } from './receive-inventory-draft.service';
import { ReceiveInventoryValidationService } from './receive-inventory-validation.service';

describe('ReceiveInventoryDraftService', () => {
  it('updates a draft and synchronizes its receive tags in one transaction', async () => {
    const receiveInventoryUpdate = jest.fn().mockResolvedValue({});
    const receiveInventoryTagCreate = jest.fn().mockResolvedValue({});
    const receiveInventoryTagDeleteMany = jest.fn().mockResolvedValue({});
    const tagFindMany = jest.fn().mockResolvedValue([{ id: 4, name: 'old' }]);
    const tagUpdate = jest.fn().mockResolvedValue({});
    const transaction = {
      receiveInventory: { update: receiveInventoryUpdate },
      receiveInventoryTag: {
        create: receiveInventoryTagCreate,
        deleteMany: receiveInventoryTagDeleteMany,
      },
      tag: {
        create: jest.fn().mockResolvedValue({}),
        findMany: tagFindMany,
        update: tagUpdate,
      },
    };
    const transactionRunner = jest.fn(
      async (callback: (client: typeof transaction) => Promise<void>) =>
        callback(transaction)
    );
    const validation = {
      assertCodeAvailable: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReceiveInventoryValidationService;
    const service = new ReceiveInventoryDraftService(
      { $transaction: transactionRunner } as unknown as PrismaService,
      validation
    );

    await service.update(
      {
        addTags: ['old'],
        code: ' RE-1 ',
        deleteTags: ['old'],
        expectedOn: new Date('2026-09-10T00:00:00.000Z'),
        note: ' Updated note ',
        receiveId: 7,
      },
      12
    );

    expect(validation.assertCodeAvailable).toHaveBeenCalledWith(' RE-1 ', 7);
    expect(receiveInventoryUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        code: 'RE-1',
        expectedAt: new Date('2026-09-10T00:00:00.000Z'),
        note: 'Updated note',
        receiveHistories: {
          create: {
            action: 'Cập nhật thông tin',
            changedUserId: 12,
            type: 'Đơn nhập',
          },
        },
      },
    });
    expect(receiveInventoryTagCreate).toHaveBeenCalledWith({
      data: { receiveId: 7, tagId: 4 },
    });
    expect(tagUpdate).toHaveBeenCalledWith({
      data: { lastUsedAt: expect.any(Date) },
      where: { id: 4 },
    });
    expect(receiveInventoryTagDeleteMany).toHaveBeenCalledWith({
      where: { receiveId: 7, tagId: { in: [4] } },
    });
  });
});
