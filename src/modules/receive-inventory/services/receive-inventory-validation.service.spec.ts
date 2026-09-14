import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReceiveInventoryValidationService } from './receive-inventory-validation.service';

describe('ReceiveInventoryValidationService', () => {
  it('rejects a duplicate receive code while allowing the current record', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 99 })
      .mockResolvedValueOnce(null);
    const service = new ReceiveInventoryValidationService({
      receiveInventory: { findFirst },
    } as unknown as PrismaService);

    await expect(service.assertCodeAvailable('RE-99')).rejects.toThrow(
      BadRequestException
    );
    await expect(
      service.assertCodeAvailable('RE-99', 99)
    ).resolves.toBeUndefined();
  });
});
