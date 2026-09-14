import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  CheckoutOrderDto,
  ConfirmPaymentReceivedDto,
  CreateTempOrderDto,
} from '../order.dto';
import { PayOsParams } from '../order.type';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderCheckoutService } from './order-checkout.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderPayOsGatewayService } from './order-pay-os-gateway.service';
import { OrderTemporaryCreationService } from './order-temporary-creation.service';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    private readonly temporaryCreationService: OrderTemporaryCreationService,
    private readonly checkoutService: OrderCheckoutService,
    private readonly cancellationService: OrderCancellationService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly payOsGateway: OrderPayOsGatewayService
  ) {}

  async createTempOrder(dto: CreateTempOrderDto, req, res: Response) {
    try {
      const actorId = dto.type === 'Customer' ? req.user.id : undefined;
      const result = await this.temporaryCreationService.create(dto, actorId);
      return res.status(result.status).json(result.body);
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      );

      return res
        .status(500)
        .json({ message: 'Đã xảy ra lỗi khi tạo hóa đơn. Vui lòng thử lại' });
    }
  }

  async cancelOrder(orderId: string) {
    return this.cancellationService.cancelTemporaryOrder(orderId);
  }

  async requestCancelOrder(orderId: string, res: Response) {
    try {
      await this.cancelOrder(orderId);
      return res.status(200).json({ message: 'Đã hủy giao dịch' });
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async checkoutOrder(dto: CheckoutOrderDto, res: Response) {
    const result = await this.checkoutService.checkout(dto);
    return res.status(result.status).json(result.body);
  }

  async createPaymentLinkWithPayOS(dto: CheckoutOrderDto, res: Response) {
    try {
      const result = await this.payOsGateway.createPaymentLink(dto);
      return res.status(result.status).json(result.body);
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async cancelPayOSPayment(query: PayOsParams, res: Response) {
    await this.payOsGateway.clearPaymentCode(query.order);
    return res.redirect(this.payOsGateway.cancelRedirect(query));
  }

  async successPayOSPayment(query: PayOsParams, res: Response) {
    await this.payOsGateway.markPaymentSucceeded(query.order);
    return res.redirect(this.payOsGateway.successRedirect());
  }

  async cancelOrderByAdmin(
    dto: {
      orderId: string;
      isReStock: boolean;
      reason: string;
    },
    req,
    res: Response
  ) {
    try {
      await this.cancellationService.cancelByAdmin(dto, Number(req.user.id));
      return res.status(200).json({ message: 'Đã hủy đơn hàng' });
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async confirmPaymentReceived(
    dto: ConfirmPaymentReceivedDto,
    req,
    res: Response
  ) {
    try {
      await this.fulfillmentService.confirmPaymentReceived(
        dto.orderId,
        Number(req.user.id)
      );
      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error: unknown) {
      return res
        .status(500)
        .json(
          error instanceof Error
            ? error.message
            : 'Đã có lỗi xảy ra. Vui lòng thử lại'
        );
    }
  }
}
