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
import { OrderService } from './order.service';
import {
  ApplyVoucherDto,
  CancelOrderDto,
  CheckoutOrderDto,
  ConfirmDeliveryDto,
  CreateTempOrderDto,
} from './order.dto';
import { Public } from 'src/decorators/Public.decorator';
import { QueryParams } from 'src/utils/types';
import { Response } from 'express';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('order')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Put('/confirm/delivery')
  confirmDelivery(@Body() dto: ConfirmDeliveryDto, @Req() req, @Res() res) {
    return this.orderService.confirmDelivery(
      dto.orderId,
      dto.isSendEmail,
      req,
      res,
    );
  }

  @Put('/cancel')
  cancelOrderByAdmin(@Body() dto: CancelOrderDto, @Req() req, @Res() res) {
    return this.orderService.cancelOrderByAdmin(dto, req, res);
  }

  @Put('/confirm/payment')
  confirmPaymentReceived(@Body() dto: CancelOrderDto, @Req() req, @Res() res) {
    return this.orderService.confirmPaymentReceived(dto, req, res);
  }

  @Get('/')
  getOrderList(@Query() query: QueryParams, @Res() res: Response) {
    return this.orderService.requestOrderList(query, res);
  }

  @Get('/admin/:orderId')
  getOrderDetail(@Param('orderId') orderId, @Res() res: Response) {
    return this.orderService.requestOrderDetail(orderId, res);
  }

  @Delete('/admin/:orderId')
  deleteOrder(@Param('orderId') orderId, @Req() req, @Res() res: Response) {
    return this.orderService.deleteOrder(orderId, req, res);
  }

  @Post('/')
  async createTempOrder(
    @Body() dto: CreateTempOrderDto,
    @Req() req,
    @Res() res,
  ) {
    return this.orderService.createTempOrder(dto, req, res);
  }

  @Public()
  @Put('/')
  async checkoutOrder(@Body() dto: CheckoutOrderDto, @Req() req, @Res() res) {
    return this.orderService.checkoutOrder(dto, req, res);
  }

  @Public()
  @Post('/voucher')
  async applyVoucher(@Body() dto: ApplyVoucherDto, @Res() res) {
    return this.orderService.applyVoucher(dto.orderId, dto.voucherCode, res);
  }

  @Public()
  @Post('/guest')
  async createGuestTempOrder(
    @Body() dto: CreateTempOrderDto,
    @Req() req,
    @Res() res,
  ) {
    return this.orderService.createTempOrder(dto, req, res);
  }

  @Public()
  @Get('/:orderId')
  async getOrderInfomation(@Param('orderId') orderId: string, @Res() res) {
    return this.orderService.fetchOrder(orderId, res);
  }

  @Public()
  @Delete('/:orderId')
  async cancelOrder(@Param('orderId') orderId: string, @Res() res) {
    return this.orderService.requestCancelOrder(orderId, res);
  }
}
