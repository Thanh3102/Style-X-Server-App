import { PrismaService } from 'src/prisma/prisma.service';
import { ReceiveInventoryQueryService } from './receive-inventory-query.service';

describe('ReceiveInventoryQueryService', () => {
  it('returns receive tag names for a detail query', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ name: 'priority' }, { name: 'seasonal' }]);
    const service = new ReceiveInventoryQueryService({
      tag: { findMany },
    } as unknown as PrismaService);

    await expect(service.getTags(7)).resolves.toEqual(['priority', 'seasonal']);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        type: expect.any(String),
        receiveTags: { some: { receiveId: 7 } },
      },
    });
  });
});
