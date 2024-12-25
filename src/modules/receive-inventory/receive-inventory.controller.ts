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
import { ReceiveInventoryService } from './receive-inventory.service';
import { Response } from 'express';
import {
  CancelReceiveInventoryDTO,
  CreateReceiveInventoryDTO,
  ImportItemDTO,
  ProcessPaymentDTO,
  UpdateReceiveInventoryDTO,
} from './receive-inventory.dto';
import { QueryParams, ReceiveInventoryPermission } from 'src/utils/types';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { Permissions } from 'src/decorators/permission.decorator';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('receive-inventory')
export class ReceiveInventoryController {
  constructor(private receiveInventoryService: ReceiveInventoryService) {}

  @Get('/:id')
  @Permissions(ReceiveInventoryPermission.Access)
  getDetail(@Param('id') id: string, @Res() res: Response) {
    return this.receiveInventoryService.getDetail(parseInt(id), res);
  }

  @Post('/processPayment')
  @Permissions(ReceiveInventoryPermission.Transaction)
  processPayment(@Body() dto: ProcessPaymentDTO, @Req() req, @Res() res) {
    return this.receiveInventoryService.processPayment(dto, req, res);
  }

  @Get('/')
  @Permissions(ReceiveInventoryPermission.Access)
  get(@Query() queryParams: QueryParams, @Res() res) {
    return this.receiveInventoryService.get(queryParams, res);
  }

  @Post('/')
  @Permissions(ReceiveInventoryPermission.Create)
  create(
    @Body() dto: CreateReceiveInventoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.receiveInventoryService.create(dto, req, res);
  }

  @Put('/')
  @Permissions(ReceiveInventoryPermission.Update)
  update(
    @Body() dto: UpdateReceiveInventoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.receiveInventoryService.update(dto, req, res);
  }

  @Put('/cancel')
  @Permissions(ReceiveInventoryPermission.Cancel)
  cancel(
    @Body() dto: CancelReceiveInventoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.receiveInventoryService.cancel(dto, req, res);
  }

  @Put('/import')
  @Permissions(ReceiveInventoryPermission.Import)
  import(@Body() dto: ImportItemDTO, @Req() req, @Res() res: Response) {
    return this.receiveInventoryService.import(dto, req, res);
  }

  @Delete('/:id')
  @Permissions(ReceiveInventoryPermission.Delete)
  delete(@Param('id') id: string, @Req() req, @Res() res: Response) {
    return this.receiveInventoryService.delete(parseInt(id), req, res);
  }
}
