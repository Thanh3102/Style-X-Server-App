import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderQueryService } from './order-query.service';
import { OrderResponseMapper } from './order-response-mapper.service';
import { OrderVoucherApplicationService } from './order-voucher-application.service';

@Injectable()
export class OrderCommandService {
  private readonly logger = new Logger(OrderCommandService.name);

  constructor(
    private readonly voucherApplicationService: OrderVoucherApplicationService,
    private readonly cancellationService: OrderCancellationService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly orderQueryService: OrderQueryService,
    private readonly responseMapper: OrderResponseMapper
  ) {}

  async applyVoucher(orderId: string, voucherCode: string, res: Response) {
    try {
      await this.voucherApplicationService.apply(orderId, voucherCode);
      return res
        .status(200)
        .json({ message: 'Sử dụng mã giảm giá thành công' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async deleteOrder(orderId: string, req, res: Response) {
    try {
      await this.cancellationService.deleteOrder(orderId, Number(req.user.id));
      return res.status(200).json({ message: 'Đã xóa đơn hàng' });
    } catch (error: unknown) {
      this.logError(error);
      return res
        .status(500)
        .json(
          error instanceof Error
            ? error.message
            : 'Đã có lỗi xảy ra. Vui lòng thử lại'
        );
    }
  }

  async confirmDelivery(
    orderId: string,
    isSendEmail: boolean,
    req,
    res: Response
  ) {
    try {
      await this.fulfillmentService.confirmDelivery(
        orderId,
        isSendEmail,
        Number(req.user.id)
      );
      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async requestOrderDetail(orderId: string, res: Response) {
    try {
      const order = await this.orderQueryService.getOrderDetail(orderId);
      const formatOrderData = this.responseMapper.toDetailResponse(order);

      return res.status(200).json(formatOrderData);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: 'Đã xảy ra lỗi',
      });
    }
  }

  private logError(error: unknown): void {
    this.logger.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
  }
}
