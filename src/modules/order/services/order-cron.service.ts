import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderPaymentService } from './order-payment.service';

@Injectable()
export class OrderCronService {
  constructor(
    private prisma: PrismaService,
    private orderPaymentService: OrderPaymentService
  ) {}

  @Cron('0 * * * * *')
  async deleteExpireOrder() {
    const expireOrders = await this.prisma.order.findMany({
      where: {
        code: null,
        expire: {
          lt: Date.now(),
        },
      },
      select: {
        id: true,
      },
    });

    for (const order of expireOrders) {
      await this.orderPaymentService.cancelOrder(order.id);
    }
  }
}
