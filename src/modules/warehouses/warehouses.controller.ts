import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { WarehousesService } from './warehouses.service';
import { QueryParams, WarehousePermission } from 'src/utils/types';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { CreateWarehouseDto } from './warehouses.dto';
import { UpdateWarehouseDto } from './warehouses.type';
import { Permissions } from 'src/decorators/permission.decorator';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('warehouses')
export class WarehousesController {
  constructor(private warehouseService: WarehousesService) {}

  @Get('/')
  get(@Query() queryParams: QueryParams) {
    return this.warehouseService.get(queryParams);
  }

  @Post('/')
  @Permissions(WarehousePermission.Create)
  create(@Body() dto: CreateWarehouseDto, @Req() req, @Res() res) {
    return this.warehouseService.create(dto, req, res);
  }

  @Put('/')
  @Permissions(WarehousePermission.Update)
  update(@Body() dto: UpdateWarehouseDto, @Req() req, @Res() res) {
    return this.warehouseService.update(dto, req, res);
  }

  // @Delete('/')
  // delete(@Body() dto: CreateWarehouseDto, @Req() req, @Res() res) {
  //   // return this.warehouseService.create(dto, req, res);
  //   return null;
  // }

  @Get('/:warehouse_id')
  @Permissions(WarehousePermission.Access)
  getDetail(
    @Param('warehouse_id') warehouseId: string,
    @Query() params: QueryParams,
    @Res() res,
  ) {
    return this.warehouseService.getDetail(parseInt(warehouseId), params, res);
  }
}
