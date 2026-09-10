import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PayOS from '@payos/node';
import { CheckoutRequestType } from '@payos/node/lib/type';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { MailService } from 'src/modules/mail/mail.service';
import { CheckoutOrderDto } from '../order.dto';
import {
  OrderStatus,
  OrderTransactionStatus,
  PayOsParams,
} from '../order.type';
import { OrderWorkflowResult } from './order-checkout.service';

@Injectable()
export class OrderPayOsGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService
  ) {}

  async createPaymentLink(dto: CheckoutOrderDto): Promise<OrderWorkflowResult> {
    const order = await this.prisma.order.findUnique({
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

    const payOS = new PayOS(
      this.configService.getOrThrow<string>('PAYOS_CLIENT_ID'),
      this.configService.getOrThrow<string>('PAYOS_API_KEY'),
      this.configService.getOrThrow<string>('PAYOS_CHECKSUM_KEY')
    );
    const orderCode = Date.now();
    const code = await generateCustomID('#', 'order', 'code', 6);

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        code,
        address: dto.address.trim(),
        province: dto.province,
        district: dto.district,
        ward: dto.ward,
        email: dto.email,
        name: dto.name,
        paymentMethod: dto.paymentMethod,
        note: dto.note?.trim(),
        receiverPhoneNumber: dto.receivePhoneNumber?.trim(),
        receiverName: dto.receiveName?.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        customerId: dto.customerId ? dto.customerId : undefined,
        status: OrderStatus.PENDING_PROCESSING,
        payOSCode: orderCode.toString(),
      },
    });

    const serverBaseUrl =
      this.configService.getOrThrow<string>('SERVER_BASE_URL');
    const checkoutRequest: CheckoutRequestType = {
      orderCode,
      amount: order.totalOrderAfterDiscount,
      description: 'Thanh toan don hang',
      cancelUrl: `${serverBaseUrl}/api/order/cancel/pay-os?order=${order.id}`,
      returnUrl: `${serverBaseUrl}/api/order/success/pay-os?order=${order.id}`,
      buyerName: dto.name.trim(),
      buyerEmail: dto.email.trim(),
      buyerPhone: dto.phoneNumber.trim(),
      buyerAddress: `${[dto.address, dto.ward, dto.district, dto.province].join(', ')}`,
      expiredAt: Math.round(Number(order.expire) / 1000),
    };
    const response = await payOS.createPaymentLink(checkoutRequest);
    return this.result(200, { checkoutUrl: response.checkoutUrl });
  }

  async clearPaymentCode(orderId: string): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { payOSCode: null },
    });
  }

  async markPaymentSucceeded(orderId: string): Promise<void> {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { transactionStatus: OrderTransactionStatus.PAID },
    });
    await this.mailService.sendUserCheckoutComplete(
      order,
      order.email,
      order.email
    );
  }

  cancelRedirect(query: PayOsParams): string {
    return `${this.configService.getOrThrow<string>('CLIENT_BASE_URL')}/checkout?order=${query.order}`;
  }

  successRedirect(): string {
    return `${this.configService.getOrThrow<string>('CLIENT_BASE_URL')}/checkout/success`;
  }

  private result(
    status: number,
    body: Record<string, unknown>
  ): OrderWorkflowResult {
    return { status, body };
  }
}
