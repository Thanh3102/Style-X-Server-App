import { PrismaService } from 'src/prisma/prisma.service';
import { SupplierCommandService } from './supplier-command.service';
import { CreateSupplierDTO } from '../suppliers.type';

describe('SupplierCommandService', () => {
  it('reads supplier tags through the transaction client', async () => {
    const transactionClient = {
      supplier: {
        create: jest.fn().mockResolvedValue({ id: 42 }),
      },
      tag: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      tag: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) =>
        callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new SupplierCommandService(prisma);
    const dto: CreateSupplierDTO = {
      name: 'Supplier',
      code: 'LOCAL-001',
      phoneNumber: undefined,
      email: undefined,
      taxCode: undefined,
      website: undefined,
      fax: undefined,
      country: undefined,
      province: undefined,
      district: undefined,
      ward: undefined,
      detailAddress: undefined,
      assignedId: '7',
      tags: [],
    };

    await service.create(dto, 7);

    expect(transactionClient.tag.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.tag.findMany).not.toHaveBeenCalled();
  });
});
