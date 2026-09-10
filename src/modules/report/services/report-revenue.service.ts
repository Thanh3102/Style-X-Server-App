import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types/query.types';
import { ReportRevenueResponse } from '../report.type';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportPeriodService } from './report-period.service';

@Injectable()
export class ReportRevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateRangeService: ReportDateRangeService,
    private readonly filterService: ReportFilterService,
    private readonly periodService: ReportPeriodService,
    private readonly mapper: ReportMapperService
  ) {}

  async get(params: QueryParams): Promise<ReportRevenueResponse> {
    const range = this.dateRangeService.resolve(params);
    const summary = await this.prisma.order.aggregate({
      _sum: {
        totalOrderAfterDiscount: true,
      },
      _avg: {
        totalOrderAfterDiscount: true,
      },
      _count: {
        id: true,
      },
      where: this.filterService.completedOrder(range),
    });

    const reports: ReportRevenueResponse['reports'] = [];
    const periods = this.periodService.createPeriods(range, params.reportDate);

    for (const period of periods) {
      const aggregate = await this.prisma.order.aggregate({
        where: this.filterService.completedOrder({
          startDate: period.startDate,
          endDate: period.endDate,
        }),
        _sum: {
          totalOrderAfterDiscount: true,
        },
        _avg: {
          totalOrderAfterDiscount: true,
        },
        _count: {
          id: true,
        },
      });

      reports.push({
        label: this.periodService.labelFor(period),
        total: aggregate._sum.totalOrderAfterDiscount ?? 0,
        avg: aggregate._avg.totalOrderAfterDiscount ?? 0,
        count: aggregate._count.id ?? 0,
      });
    }

    return this.mapper.revenue({
      grossProfit: summary._sum.totalOrderAfterDiscount ?? 0,
      averageOrder: summary._avg.totalOrderAfterDiscount ?? 0,
      numberOfOrders: summary._count.id ?? 0,
      reports,
    });
  }
}
