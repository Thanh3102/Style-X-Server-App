import { Module } from '@nestjs/common';
import { ReceiveInventoryController } from './receive-inventory.controller';
import { ReceiveInventoryService } from './receive-inventory.service';

@Module({
  controllers: [ReceiveInventoryController],
  providers: [ReceiveInventoryService],
})
export class ReceiveInventoryModule {}
