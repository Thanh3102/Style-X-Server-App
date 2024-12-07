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
import { DiscountService } from './discount.service';
import { CreateDiscountDTO, UpdateDiscountDTO } from './discount.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { Response } from 'express';
import { QueryParams } from 'src/utils/types';
import { isInteger } from 'src/utils/helper/StringHelper';
import { Public } from 'src/decorators/Public.decorator';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('discount')
export class DiscountController {
  constructor(private discountService: DiscountService) {}

  @Get('/:id')
  getDetail(@Param('id') id: string, @Res() res: Response) {
    return this.discountService.getDetail(id, res);
  }

  @Get('/')
  get(@Query() queryParams: QueryParams, @Res() res: Response) {
    return this.discountService.get(queryParams, res);
  }

  @Post('/')
  create(@Body() dto: CreateDiscountDTO, @Req() req, @Res() res) {
    return this.discountService.create(dto, req, res);
  }

  @Put('/')
  update(@Body() dto: UpdateDiscountDTO, @Req() req, @Res() res) {
    return this.discountService.update(dto, req, res);
  }

  @Put('/active/:id')
  updateActive(
    @Param('id') id: string,
    @Body() { active }: { active: boolean },
    @Res() res: Response,
  ) {
    if (!isInteger(id))
      return res.json({ message: 'Mã khuyến mại không hơp lệ' });
    return this.discountService.updateActive(parseInt(id), active, res);
  }

  @Delete('/:id')
  delete(@Param('id') id: string, @Res() res: Response) {
    if (!isInteger(id))
      return res.json({ message: 'Mã khuyến mại không hơp lệ' });
    return this.discountService.delete(parseInt(id), res);
  }
}
