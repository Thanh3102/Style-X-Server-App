import { PrismaService } from 'src/prisma/prisma.service';
import { ReportCalculationService } from './report-calculation.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportPeriodService } from './report-period.service';
import { ReportProductRevenueService } from './report-product-revenue.service';
import { ReportSorterService } from './report-sorter.service';

describe('ReportProductRevenueService', () => {
  it('returns product revenue detail rows with their period cost and totals', async () => {
    const orderAggregate = jest.fn().mockResolvedValue({
      _count: { id: 2 },
    });
    const orderItemAggregate = jest.fn().mockResolvedValue({
      _sum: {
        totalPriceBeforeDiscount: 50,
        totalPriceAfterDiscount: 40,
        totalDiscountAmount: 10,
      },
      _avg: { totalPriceAfterDiscount: 20 },
    });
    const orderItemFindMany = jest
      .fn()
      .mockResolvedValueOnce([{ product: { id: 1, name: 'Tee' } }])
      .mockResolvedValueOnce([
        {
          quantity: 3,
          sources: [{ costPrice: 5, quantity: 3 }],
        },
      ]);
    const prisma = {
      order: { aggregate: orderAggregate },
      orderItem: {
        aggregate: orderItemAggregate,
        findMany: orderItemFindMany,
      },
    } as unknown as PrismaService;
    const service = new ReportProductRevenueService(
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
    ).resolves.toEqual([
      {
        product: { id: 1, name: 'Tee' },
        reports: [
          {
            time: '5/2/2026',
            averageOrderValue: 20,
            cost: 15,
            discount: 10,
            goodValue: 50,
            grossProfit: 25,
            netRevenue: 40,
            numberOfOrder: 2,
            numberOfItem: 3,
          },
        ],
        totalAverageOrderValue: 20,
        totalCost: 15,
        totalDiscount: 10,
        totalGoodValue: 50,
        totalGrossProfit: 25,
        totalNetRevenue: 40,
        totalNumberOfItem: 3,
        totalNumberOfOrder: 2,
      },
    ]);
  });
});
