import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
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
import { query, Response } from 'express';
import {
  CancelReceiveInventoryDTO,
  CreateReceiveInventoryDTO,
  ImportItemDTO,
  ProcessPaymentDTO,
  UpdateReceiveInventoryDTO,
} from './receive-inventory.dto';
import { QueryParams } from 'src/utils/types';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('receive-inventory')
export class ReceiveInventoryController {
  constructor(private receiveInventoryService: ReceiveInventoryService) {}

  @Get('/:id')
  getDetail(@Param('id') id: string, @Res() res: Response) {
    return this.receiveInventoryService.getDetail(parseInt(id), res);
  }

  @Post('/processPayment')
  processPayment(@Body() dto: ProcessPaymentDTO, @Req() req, @Res() res) {
    return this.receiveInventoryService.processPayment(dto, req, res);
  }

  @Get('/')
  get(@Query() queryParams: QueryParams, @Res() res) {
    return this.receiveInventoryService.get(queryParams, res);
  }

  @Post('/')
  create(
    @Body() dto: CreateReceiveInventoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.receiveInventoryService.create(dto, req, res);
  }

  @Put('/')
  update(
    @Body() dto: UpdateReceiveInventoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.receiveInventoryService.update(dto, req, res);
  }

  @Put('/cancel')
  cancel(
    @Body() dto: CancelReceiveInventoryDTO,
    @Req() req,
    @Res() res: Response,
  ) {
    return this.receiveInventoryService.cancel(dto, req, res);
  }

  @Put('/import')
  import(@Body() dto: ImportItemDTO, @Req() req, @Res() res: Response) {
    return this.receiveInventoryService.import(dto, req, res);
  }

  @Delete('/:id')
  delete(@Param('id') id: string, @Req() req, @Res() res: Response) {
    return this.receiveInventoryService.delete(parseInt(id), req, res);
  }
}
