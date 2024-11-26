import {
  BadRequestException,
  Body,
  Controller,
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
import { Response } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { InventoriesService } from './inventories.service';
import { ChangeOnHandDTO } from './inventories.dto';
import { isInteger } from 'src/utils/helper/StringHelper';
import { QueryParams } from 'src/utils/types';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('inventories')
export class InventoriesController {
  constructor(private inventoriesService: InventoriesService) {}

  @Post('/')
  create(@Body() dto, @Req() req, @Res() res: Response) {
    return this.inventoriesService.create(dto, req, res);
  }

  @Put('/changeOnHand')
  changeOnHand(@Body() dto: ChangeOnHandDTO, @Req() req, @Res() res: Response) {
    return this.inventoriesService.changeOnHand(dto, req, res);
  }

  @Get('/:variantId/warehouses')
  getVariantWarehouses(@Param() { variantId }) {
    if (isInteger(variantId))
      return this.inventoriesService.getVariantWarehouses(parseInt(variantId));

    throw new BadRequestException('Mã phiên bản không hợp lệ');
  }

  @Get('/history')
  getHistory(@Query() queryParams: QueryParams) {
    return this.inventoriesService.getHistory(queryParams);
  }
}
