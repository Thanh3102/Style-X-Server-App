import { PrismaService } from 'src/prisma/prisma.service';
import { ReportCalculationService } from './report-calculation.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportPeriodService } from './report-period.service';
import { ReportRevenueDetailService } from './report-revenue-detail.service';
import { ReportSorterService } from './report-sorter.service';

describe('ReportRevenueDetailService', () => {
  it('returns detailed totals and cost for each selected day', async () => {
    const orderAggregate = jest.fn().mockResolvedValue({
      _sum: {
        totalOrderBeforeDiscount: 130,
        totalOrderAfterDiscount: 100,
        totalOrderDiscountAmount: 30,
      },
      _avg: { totalOrderAfterDiscount: 50 },
      _count: { id: 2 },
    });
    const orderItemFindMany = jest.fn().mockResolvedValue([
      {
        quantity: 3,
        sources: [{ costPrice: 20, quantity: 3 }],
      },
    ]);
    const prisma = {
      order: { aggregate: orderAggregate },
      orderItem: { findMany: orderItemFindMany },
    } as unknown as PrismaService;
    const service = new ReportRevenueDetailService(
      prisma,
      new ReportDateRangeService(),
      new ReportFilterService(),
      new ReportPeriodService(),
      new ReportCalculationService(),
      new ReportMapperService(new ReportSorterService())
    );

    await expect(
      service.get({
        reportDateMin: '05/02/2026',
        reportDateMax: '05/02/2026',
      })
    ).resolves.toEqual({
      reports: [
        {
          time: '5/2/2026',
          label: '5/2',
          numberOfOrder: 2,
          numberOfOrderItem: 3,
          goodValue: 130,
          discount: 30,
          netRevenue: 100,
          grossProfit: 40,
          averageOrderValue: 50,
          cost: 60,
        },
      ],
      totalAverageOrderValue: 50,
      totalCost: 60,
      totalDiscount: 30,
      totalGoodValue: 130,
      totalGrossProfit: 40,
      totalNetRevenue: 100,
      totalNumberOfOrderItem: 3,
      totalNumberOfOrder: 2,
    });
  });
});
