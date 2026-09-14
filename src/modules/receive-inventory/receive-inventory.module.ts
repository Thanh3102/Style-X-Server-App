import { Module } from '@nestjs/common';
import { ReceiveInventoryController } from './receive-inventory.controller';
import { ReceiveInventoryService } from './receive-inventory.service';
import { ReceiveInventoryDraftService } from './services/receive-inventory-draft.service';
import { ReceiveInventoryMapper } from './services/receive-inventory-mapper.service';
import { ReceiveInventoryQueryService } from './services/receive-inventory-query.service';
import { ReceiveInventoryTransactionService } from './services/receive-inventory-transaction.service';
import { ReceiveInventoryValidationService } from './services/receive-inventory-validation.service';

@Module({
  controllers: [ReceiveInventoryController],
  providers: [
    ReceiveInventoryService,
    ReceiveInventoryDraftService,
    ReceiveInventoryMapper,
    ReceiveInventoryQueryService,
    ReceiveInventoryTransactionService,
    ReceiveInventoryValidationService,
  ],
})
export class ReceiveInventoryModule {}
