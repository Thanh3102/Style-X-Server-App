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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDTO, UpdateSupplierDTO } from './suppliers.dto';
import { Response } from 'express';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { FilterParam, QueryParams, SupplierPermission } from 'src/utils/types';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { Permissions } from 'src/decorators/permission.decorator';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('suppliers')
export class SuppliersController {
  constructor(private supplierService: SuppliersService) {}

  @Get('/')
  @Permissions(SupplierPermission.Access)
  getData(@Query() queryParams: QueryParams, @Res() res) {
    return this.supplierService.getData(res, queryParams);
  }

  @Get('detail/:id')
  @Permissions(SupplierPermission.Access)
  getDetail(@Param() { id }, @Res() res) {
    return this.supplierService.getDetail(id, res);
  }

  @Post('/create')
  @Permissions(SupplierPermission.Create)
  create(@Body() dto: CreateSupplierDTO, @Req() req, @Res() res: Response) {
    return this.supplierService.create(dto, req, res);
  }

  @Put('/')
  @Permissions(SupplierPermission.Update)
  update(@Body() dto: UpdateSupplierDTO, @Req() req, @Res() res) {
    return this.supplierService.update(dto, req, res);
  }

  @Delete('/:id')
  @Permissions(SupplierPermission.Delete)
  delete(@Param() { id }: { id: string }, @Req() req, @Res() res: Response) {
    return this.supplierService.delete(Number(id), req, res);
  }
}
