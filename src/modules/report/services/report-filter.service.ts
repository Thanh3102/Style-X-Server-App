import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderStatus } from '../../order/order.type';
import { ReportDateRange } from './report-date-range.service';

@Injectable()
export class ReportFilterService {
  completedOrder(range?: ReportDateRange): Prisma.OrderWhereInput {
    const whereInput: Prisma.OrderWhereInput = {
      void: false,
      status: OrderStatus.COMPLETE,
    };

    if (range) {
      whereInput.createdAt = {
        gte: range.startDate,
        lte: range.endDate,
      };
    }

    return whereInput;
  }

  productWithCompletedOrders(range: ReportDateRange): Prisma.ProductWhereInput {
    return {
      orderItems: {
        some: {
          order: this.completedOrder(range),
        },
      },
    };
  }

  orderItemsForProduct(
    productId: number,
    range: ReportDateRange
  ): Prisma.OrderItemWhereInput {
    return {
      productId,
      order: this.completedOrder(range),
    };
  }

  orderItems(range: ReportDateRange): Prisma.OrderItemWhereInput {
    return {
      order: this.completedOrder(range),
    };
  }

  productRevenueItems(range: ReportDateRange): Prisma.OrderItemWhereInput {
    return {
      product: {
        void: false,
      },
      order: this.completedOrder(range),
    };
  }

  ordersContainingProduct(
    productId: number,
    range: ReportDateRange
  ): Prisma.OrderWhereInput {
    return {
      ...this.completedOrder(range),
      items: {
        some: {
          productId,
        },
      },
    };
  }
}
