import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { QueryParams } from 'src/utils/types';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { ChangePasswordDto, UpdateInfoDto } from './customer.type';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('customer')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  @Get('/history')
  getOrderHistory(
    @Query() query: { status: string; page: string; limit: string },
    @Req() req,
    @Res() res,
  ) {
    return this.customerService.getOrderHistory(query, req, res);
  }

  @Get('/')
  getCustomer(@Query() query: QueryParams, @Res() res) {
    return this.customerService.get(query, res);
  }

  @Get('/info')
  getInfo(@Req() req, @Res() res) {
    return this.customerService.getInfo(req, res);
  }

  @Put('/info')
  updateInfo(@Body() dto: UpdateInfoDto, @Req() req, @Res() res) {
    return this.customerService.updateInfo(dto, req, res);
  }

  @Put('/changePassword')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req, @Res() res) {
    return this.customerService.changePassword(dto, req, res);
  }

  @Get('/:customerId')
  getCustomerDetail(
    @Param('customerId') customerId,
    @Query() query: QueryParams,
    @Res() res,
  ) {
    return this.customerService.getDetail(customerId, query, res);
  }
}
