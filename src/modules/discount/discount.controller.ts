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
import { DiscountPermission, QueryParams } from 'src/utils/types';
import { isInteger } from 'src/utils/helper/StringHelper';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { Permissions } from 'src/decorators/permission.decorator';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('discount')
export class DiscountController {
  constructor(private discountService: DiscountService) {}

  @Get('/:id')
  @Permissions(DiscountPermission.Access)
  getDetail(@Param('id') id: string, @Res() res: Response) {
    return this.discountService.getDetail(id, res);
  }

  @Get('/')
  @Permissions(DiscountPermission.Access)
  get(@Query() queryParams: QueryParams, @Res() res: Response) {
    return this.discountService.get(queryParams, res);
  }

  @Post('/')
  @Permissions(DiscountPermission.Create)
  create(@Body() dto: CreateDiscountDTO, @Req() req, @Res() res) {
    return this.discountService.create(dto, req, res);
  }

  @Put('/')
  @Permissions(DiscountPermission.Update)
  update(@Body() dto: UpdateDiscountDTO, @Req() req, @Res() res) {
    return this.discountService.update(dto, req, res);
  }

  @Put('/active/:id')
  @Permissions(DiscountPermission.Update)
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
  @Permissions(DiscountPermission.Delete)
  delete(@Param('id') id: string, @Res() res: Response) {
    if (!isInteger(id))
      return res.json({ message: 'Mã khuyến mại không hơp lệ' });
    return this.discountService.delete(parseInt(id), res);
  }
}
