import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { CheckoutOrderDto } from '../order.dto';
import { OrderStatus } from '../order.type';
import { OrderNotificationService } from './order-notification.service';

export type OrderWorkflowResult = {
  status: number;
  body: Record<string, unknown>;
};

@Injectable()
export class OrderCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: OrderNotificationService
  ) {}

  async checkout(dto: CheckoutOrderDto): Promise<OrderWorkflowResult> {
    let sendNotification: (() => Promise<void>) | undefined;
    const workflow = await this.prisma.$transaction(async (transaction) => {
      const order = await transaction.order.findUnique({
        where: { id: dto.orderId },
      });

      if (!order) {
        return this.result(400, {
          message: 'Giao dịch không tồn tại. Vui lòng tạo hóa đơn khác',
        });
      }

      if (Date.now() > Number(order.expire)) {
        return this.result(400, {
          message: 'Giao dịch đã hết hạn. Vui lòng tạo hóa đơn khác',
        });
      }

      const code = await generateCustomID('#', 'order', 'code', 6);
      const updatedOrder = await transaction.order.update({
        where: { id: dto.orderId },
        data: {
          code,
          address: dto.address.trim(),
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          email: dto.email.trim(),
          name: dto.name.trim(),
          phoneNumber: dto.phoneNumber.trim(),
          paymentMethod: dto.paymentMethod,
          note: dto.note ? dto.note.trim() : undefined,
          receiverPhoneNumber: dto.receivePhoneNumber
            ? dto.receivePhoneNumber.trim()
            : undefined,
          receiverName: dto.receiveName ? dto.receiveName.trim() : undefined,
          customerId: dto.customerId ? dto.customerId : undefined,
          status: OrderStatus.PENDING_PROCESSING,
        },
        include: {
          items: {
            select: {
              quantity: true,
              priceAfterDiscount: true,
              totalPriceAfterDiscount: true,
              product: { select: { name: true } },
            },
          },
        },
      });

      sendNotification = () =>
        this.notificationService.sendCheckoutComplete(
          updatedOrder,
          dto.email,
          dto.name
        );

      return this.result(200, { message: 'Tạo đơn hàng thành công.' });
    });

    if (sendNotification) await sendNotification();
    return workflow;
  }

  private result(
    status: number,
    body: Record<string, unknown>
  ): OrderWorkflowResult {
    return { status, body };
  }
}
