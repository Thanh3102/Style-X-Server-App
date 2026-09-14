import { Module } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller';
import { WarehouseCommandService } from './services/warehouse-command.service';
import { WarehouseQueryService } from './services/warehouse-query.service';
import { WarehousesService } from './warehouses.service';

@Module({
  controllers: [WarehousesController],
  providers: [
    WarehousesService,
    WarehouseQueryService,
    WarehouseCommandService,
  ],
  exports: [WarehousesService],
})
export class WarehousesModule {}
