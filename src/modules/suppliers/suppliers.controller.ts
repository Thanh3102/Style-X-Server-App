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
import { FilterParam, QueryParams } from 'src/utils/types';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('suppliers')
export class SuppliersController {
  constructor(private supplierService: SuppliersService) {}

  @Get('/')
  getData(@Query() queryParams: QueryParams, @Res() res) {
    return this.supplierService.getData(res, queryParams);
  }

  @Get('detail/:id')
  getDetail(@Param() { id }, @Res() res) {
    return this.supplierService.getDetail(id, res);
  }

  @Post('/create')
  create(@Body() dto: CreateSupplierDTO, @Req() req, @Res() res: Response) {
    return this.supplierService.create(dto, req, res);
  }

  @Put('/')
  update(@Body() dto: UpdateSupplierDTO, @Req() req, @Res() res) {
    return this.supplierService.update(dto, req, res);
  }

  @Delete('/:id')
  delete(@Param() { id }: { id: string }, @Req() req, @Res() res: Response) {
    return this.supplierService.delete(Number(id), req, res);
  }
}
