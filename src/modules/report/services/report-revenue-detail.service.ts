import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';
import { ReportRevenueDetailResponse } from '../report.type';
import { ReportCalculationService } from './report-calculation.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportPeriodService } from './report-period.service';

@Injectable()
export class ReportRevenueDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateRangeService: ReportDateRangeService,
    private readonly filterService: ReportFilterService,
    private readonly periodService: ReportPeriodService,
    private readonly calculationService: ReportCalculationService,
    private readonly mapper: ReportMapperService
  ) {}

  async get(params: QueryParams): Promise<ReportRevenueDetailResponse> {
    const range = this.dateRangeService.resolve(params, {
      defaultToToday: true,
    });
    const reports: ReportRevenueDetailResponse['reports'] = [];
    let totalNumberOfOrder = 0;
    let totalNumberOfOrderItem = 0;
    let totalGoodValue = 0;
    let totalDiscount = 0;
    let totalNetRevenue = 0;
    let totalGrossProfit = 0;
    let totalAverageOrderValue = 0;
    let totalCost = 0;

    const periods = this.periodService.createPeriods(range, params.reportDate);

    for (const period of periods) {
      const periodRange = {
        startDate: period.startDate,
        endDate: period.endDate,
      };
      const aggregate = await this.prisma.order.aggregate({
        where: this.filterService.completedOrder(periodRange),
        _sum: {
          totalOrderAfterDiscount: true,
          totalOrderBeforeDiscount: true,
          totalOrderDiscountAmount: true,
        },
        _avg: {
          totalOrderAfterDiscount: true,
        },
        _count: {
          id: true,
        },
      });

      const orderItems = await this.prisma.orderItem.findMany({
        where: this.filterService.orderItems(periodRange),
        select: {
          quantity: true,
          sources: {
            select: {
              costPrice: true,
              quantity: true,
            },
          },
        },
      });

      const goodValue = aggregate._sum.totalOrderBeforeDiscount;
      const netRevenue = aggregate._sum.totalOrderAfterDiscount;
      const discount = aggregate._sum.totalOrderDiscountAmount;
      const averageOrderValue = aggregate._avg.totalOrderAfterDiscount;
      const numberOfOrder = aggregate._count.id;
      const cost = this.calculationService.orderItemCost(orderItems);

      totalNumberOfOrder += numberOfOrder;
      totalNumberOfOrderItem += cost.quantity;
      totalGoodValue += goodValue;
      totalDiscount += discount;
      totalNetRevenue += netRevenue;
      totalGrossProfit += netRevenue - cost.cost;
      totalAverageOrderValue += averageOrderValue;
      totalCost += cost.cost;

      reports.push({
        label: this.periodService.labelFor(period),
        time: this.periodService.timeFor(period),
        averageOrderValue,
        cost: cost.cost,
        discount,
        goodValue,
        grossProfit: netRevenue - cost.cost,
        netRevenue,
        numberOfOrder,
        numberOfOrderItem: cost.quantity,
      });
    }

    return this.mapper.revenueDetail({
      reports,
      totalAverageOrderValue,
      totalCost,
      totalDiscount,
      totalGoodValue,
      totalGrossProfit,
      totalNetRevenue,
      totalNumberOfOrderItem,
      totalNumberOfOrder,
    });
  }
}
