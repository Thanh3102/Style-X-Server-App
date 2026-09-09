import { Module } from '@nestjs/common';
import { InventoriesController } from './inventories.controller';
import { InventoryHistoryQueryService } from './services/inventory-history-query.service';
import { InventoryQueryService } from './services/inventory-query.service';
import { InventoryStockService } from './services/inventory-stock.service';
import { InventoriesService } from './inventories.service';

@Module({
  controllers: [InventoriesController],
  providers: [
    InventoriesService,
    InventoryStockService,
    InventoryQueryService,
    InventoryHistoryQueryService,
  ],
  exports: [InventoriesService],
})
export class InventoriesModule {}
