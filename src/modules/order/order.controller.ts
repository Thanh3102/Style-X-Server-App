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
import { Public } from 'src/decorators/public.decorator';
import { OrderPermission, QueryParams } from 'src/utils/types';
import { Response } from 'express';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { Permissions } from 'src/decorators/permission.decorator';
import { PayOsParams } from './order.type';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('order')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Public()
  @Get('/vnpay_return')
  vnpayReturn(@Req() req, @Res() res) {
    return this.orderService.VNPAY_RETURN(req, res);
  }

  @Public()
  @Get('/cancel/pay-os')
  cancelOrderPayOS(@Query() query: PayOsParams, @Res() res: Response) {
    return this.orderService.cancelPayOSPayment(query, res);
  }

  @Public()
  @Get('/success/pay-os')
  successOrderPayOS(@Query() query: PayOsParams, @Res() res: Response) {
    return this.orderService.successPayOSPayment(query, res);
  }

  @Put('/confirm/delivery')
  @Permissions(OrderPermission.StatusUpdate)
  confirmDelivery(@Body() dto: ConfirmDeliveryDto, @Req() req, @Res() res) {
    return this.orderService.confirmDelivery(
      dto.orderId,
      dto.isSendEmail,
      req,
      res,
    );
  }

  @Put('/cancel')
  @Permissions(OrderPermission.Cancel)
  cancelOrderByAdmin(@Body() dto: CancelOrderDto, @Req() req, @Res() res) {
    return this.orderService.cancelOrderByAdmin(dto, req, res);
  }

  @Put('/confirm/payment')
  @Permissions(OrderPermission.StatusUpdate)
  confirmPaymentReceived(@Body() dto: CancelOrderDto, @Req() req, @Res() res) {
    return this.orderService.confirmPaymentReceived(dto, req, res);
  }

  @Get('/')
  @Permissions(OrderPermission.Access)
  getOrderList(@Query() query: QueryParams, @Res() res: Response) {
    return this.orderService.requestOrderList(query, res);
  }

  @Get('/admin/:orderId')
  @Permissions(OrderPermission.Access)
  getOrderDetail(@Param('orderId') orderId, @Res() res: Response) {
    return this.orderService.requestOrderDetail(orderId, res);
  }

  @Delete('/admin/:orderId')
  @Permissions(OrderPermission.Delete)
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
  @Post('/payment/pay-os')
  createPaymentLinkWithPayOS(@Body() dto: CheckoutOrderDto, @Res() res) {
    return this.orderService.createPaymentLinkWithPayOS(dto, res);
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
