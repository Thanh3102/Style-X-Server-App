import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';
import { ReportProductRevenueDetailResponse } from '../report.type';
import { ReportCalculationService } from './report-calculation.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportPeriodService } from './report-period.service';

@Injectable()
export class ReportProductRevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateRangeService: ReportDateRangeService,
    private readonly filterService: ReportFilterService,
    private readonly periodService: ReportPeriodService,
    private readonly calculationService: ReportCalculationService,
    private readonly mapper: ReportMapperService
  ) {}

  async get(params: QueryParams): Promise<ReportProductRevenueDetailResponse> {
    const range = this.dateRangeService.resolve(params, {
      defaultToToday: true,
    });
    const products = await this.prisma.orderItem
      .findMany({
        distinct: ['productId'],
        where: this.filterService.productRevenueItems(range),
        select: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
      .then((data) => data.map((item) => item.product));
    const response: ReportProductRevenueDetailResponse = [];
    const periods = this.periodService.createPeriods(range, params.reportDate);

    for (const product of products) {
      const reports: ReportProductRevenueDetailResponse[0]['reports'] = [];
      let totalNumberOfOrder = 0;
      let totalNumberOfItem = 0;
      let totalGoodValue = 0;
      let totalDiscount = 0;
      let totalNetRevenue = 0;
      let totalGrossProfit = 0;
      let totalAverageOrderValue = 0;
      let totalCost = 0;

      for (const period of periods) {
        const periodRange = {
          startDate: period.startDate,
          endDate: period.endDate,
        };
        const orderAggregate = await this.prisma.order.aggregate({
          where: this.filterService.ordersContainingProduct(
            product.id,
            periodRange
          ),
          _count: {
            id: true,
          },
        });
        const itemAggregate = await this.prisma.orderItem.aggregate({
          where: this.filterService.orderItemsForProduct(
            product.id,
            periodRange
          ),
          _sum: {
            totalPriceBeforeDiscount: true,
            totalPriceAfterDiscount: true,
            totalDiscountAmount: true,
          },
          _avg: {
            totalPriceAfterDiscount: true,
          },
        });
        const orderItems = await this.prisma.orderItem.findMany({
          where: this.filterService.orderItemsForProduct(
            product.id,
            periodRange
          ),
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

        const numberOfOrder = orderAggregate._count.id;
        const goodValue = itemAggregate._sum.totalPriceBeforeDiscount;
        const netRevenue = itemAggregate._sum.totalPriceAfterDiscount;
        const discount = itemAggregate._sum.totalDiscountAmount;
        const cost = this.calculationService.orderItemCost(orderItems);

        totalNumberOfOrder += numberOfOrder;
        totalNumberOfItem += cost.quantity;
        totalGoodValue += goodValue;
        totalDiscount += discount;
        totalNetRevenue += netRevenue;
        totalGrossProfit += netRevenue - cost.cost;
        totalAverageOrderValue += netRevenue / numberOfOrder;
        totalCost += cost.cost;

        reports.push({
          time: this.periodService.timeFor(period),
          averageOrderValue:
            netRevenue / numberOfOrder ? netRevenue / numberOfOrder : 0,
          cost: cost.cost,
          discount: discount ?? 0,
          goodValue: goodValue ?? 0,
          grossProfit: netRevenue - cost.cost,
          netRevenue: netRevenue ?? 0,
          numberOfOrder,
          numberOfItem: cost.quantity,
        });
      }

      response.push({
        product,
        reports,
        totalAverageOrderValue,
        totalCost,
        totalDiscount,
        totalGoodValue,
        totalGrossProfit,
        totalNetRevenue,
        totalNumberOfItem,
        totalNumberOfOrder,
      });
    }

    return this.mapper.productRevenueDetail(response);
  }
}
