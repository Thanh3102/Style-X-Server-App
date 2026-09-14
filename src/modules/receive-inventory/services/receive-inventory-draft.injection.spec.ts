import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReceiveInventoryDraftService } from './receive-inventory-draft.service';
import { ReceiveInventoryValidationService } from './receive-inventory-validation.service';

describe('ReceiveInventoryDraftService injection', () => {
  it('resolves the draft service with the Prisma provider', async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReceiveInventoryDraftService,
        ReceiveInventoryValidationService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    expect(module.get(ReceiveInventoryDraftService)).toBeInstanceOf(
      ReceiveInventoryDraftService
    );
    await module.close();
  });
});
