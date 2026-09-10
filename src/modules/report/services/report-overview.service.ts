import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';
import { ReportOverviewResponse } from '../report.type';
import { ReportCalculationService } from './report-calculation.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';

@Injectable()
export class ReportOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateRangeService: ReportDateRangeService,
    private readonly filterService: ReportFilterService,
    private readonly calculationService: ReportCalculationService,
    private readonly mapper: ReportMapperService
  ) {}

  async get(params: QueryParams): Promise<ReportOverviewResponse> {
    const range = this.dateRangeService.resolve(params);
    const where = this.filterService.completedOrder(range);
    const orderAggregate = await this.prisma.order.aggregate({
      _avg: {
        totalOrderAfterDiscount: true,
      },
      _sum: {
        totalOrderAfterDiscount: true,
      },
      _count: {
        id: true,
      },
      where,
    });

    const variants = await this.prisma.productVariants.findMany({
      where: {
        void: false,
      },
      select: {
        costPrice: true,
        receiveItems: {
          select: {
            finalTotal: true,
            finalPrice: true,
            quantityReceived: true,
            quantityAvaiable: true,
          },
        },
        inventories: {
          select: {
            avaiable: true,
          },
        },
      },
    });

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: where,
      },
      select: {
        sources: {
          select: {
            costPrice: true,
            quantity: true,
          },
        },
      },
    });

    const grossProfit = orderAggregate._sum.totalOrderAfterDiscount ?? 0;
    const numberOfOrders = orderAggregate._count.id;
    const inventoryValue = this.calculationService.inventoryValue(variants);
    const totalCostPrice =
      this.calculationService.orderItemCost(orderItems).cost;

    return this.mapper.overview({
      grossProfit,
      inventoryValue,
      totalCostPrice,
      numberOfOrders,
    });
  }
}
