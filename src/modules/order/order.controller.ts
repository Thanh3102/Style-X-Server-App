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
import { OrderQueryService } from './services/order-query.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderCommandService } from './services/order-command.service';

@UseGuards(JwtGuard, PermissionsGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('order')
export class OrderController {
  constructor(
    private orderQueryService: OrderQueryService,
    private orderPaymentService: OrderPaymentService,
    private orderCommandService: OrderCommandService
  ) {}

  @Public()
  @Get('/cancel/pay-os')
  cancelOrderPayOS(@Query() query: PayOsParams, @Res() res: Response) {
    return this.orderPaymentService.cancelPayOSPayment(query, res);
  }

  @Public()
  @Get('/success/pay-os')
  successOrderPayOS(@Query() query: PayOsParams, @Res() res: Response) {
    return this.orderPaymentService.successPayOSPayment(query, res);
  }

  @Put('/confirm/delivery')
  @Permissions(OrderPermission.StatusUpdate)
  confirmDelivery(@Body() dto: ConfirmDeliveryDto, @Req() req, @Res() res) {
    return this.orderCommandService.confirmDelivery(
      dto.orderId,
      dto.isSendEmail,
      req,
      res
    );
  }

  @Put('/cancel')
  @Permissions(OrderPermission.Cancel)
  cancelOrderByAdmin(@Body() dto: CancelOrderDto, @Req() req, @Res() res) {
    return this.orderPaymentService.cancelOrderByAdmin(dto, req, res);
  }

  @Put('/confirm/payment')
  @Permissions(OrderPermission.StatusUpdate)
  confirmPaymentReceived(@Body() dto: CancelOrderDto, @Req() req, @Res() res) {
    return this.orderPaymentService.confirmPaymentReceived(dto, req, res);
  }

  @Get('/')
  @Permissions(OrderPermission.Access)
  getOrderList(@Query() query: QueryParams, @Res() res: Response) {
    return this.orderQueryService.requestOrderList(query, res);
  }

  @Get('/admin/:orderId')
  @Permissions(OrderPermission.Access)
  getOrderDetail(@Param('orderId') orderId, @Res() res: Response) {
    return this.orderCommandService.requestOrderDetail(orderId, res);
  }

  @Delete('/admin/:orderId')
  @Permissions(OrderPermission.Delete)
  deleteOrder(@Param('orderId') orderId, @Req() req, @Res() res: Response) {
    return this.orderCommandService.deleteOrder(orderId, req, res);
  }

  @Post('/')
  async createTempOrder(
    @Body() dto: CreateTempOrderDto,
    @Req() req,
    @Res() res
  ) {
    return this.orderPaymentService.createTempOrder(dto, req, res);
  }

  @Public()
  @Put('/')
  async checkoutOrder(@Body() dto: CheckoutOrderDto, @Res() res) {
    return this.orderPaymentService.checkoutOrder(dto, res);
  }

  @Public()
  @Post('/payment/pay-os')
  createPaymentLinkWithPayOS(@Body() dto: CheckoutOrderDto, @Res() res) {
    return this.orderPaymentService.createPaymentLinkWithPayOS(dto, res);
  }

  @Public()
  @Post('/voucher')
  async applyVoucher(@Body() dto: ApplyVoucherDto, @Res() res) {
    return this.orderCommandService.applyVoucher(
      dto.orderId,
      dto.voucherCode,
      res
    );
  }

  @Public()
  @Post('/guest')
  async createGuestTempOrder(
    @Body() dto: CreateTempOrderDto,
    @Req() req,
    @Res() res
  ) {
    return this.orderPaymentService.createTempOrder(dto, req, res);
  }

  @Public()
  @Get('/:orderId')
  async getOrderInfomation(@Param('orderId') orderId: string, @Res() res) {
    const order = await this.orderQueryService.getOrder(orderId);

    if (!order)
      return res.status(404).json({
        message:
          'Hóa đơn không tồn tại hoặc đã hết thời gian giao dịch. Vui lòng tạo hóa đơn mới',
      });

    if (Date.now() > order.expire) {
      return res.status(400).json({
        message: 'Phiên giao dịch đã hết hạn. Vui lòng tạo hóa đơn mới',
      });
    }

    return res.status(200).json({ ...order, expire: Number(order.expire) });
  }

  @Public()
  @Delete('/:orderId')
  async cancelOrder(@Param('orderId') orderId: string, @Res() res) {
    return this.orderPaymentService.requestCancelOrder(orderId, res);
  }
}
