import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { WarehousesService } from './warehouses.service';
import { QueryParams } from 'src/utils/types';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('warehouses')
export class WarehousesController {
  constructor(private warehouseService: WarehousesService) {}

  @Get('/')
  get(@Query() queryParams: QueryParams) {
    return this.warehouseService.get(queryParams);
  }
}
