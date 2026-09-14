import { PrismaService } from 'src/prisma/prisma.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportPeriodService } from './report-period.service';
import { ReportRevenueService } from './report-revenue.service';
import { ReportSorterService } from './report-sorter.service';

describe('ReportRevenueService', () => {
  it('returns the summary and one report row for each selected day', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({
        _sum: { totalOrderAfterDiscount: 100 },
        _avg: { totalOrderAfterDiscount: 50 },
        _count: { id: 2 },
      })
      .mockResolvedValueOnce({
        _sum: { totalOrderAfterDiscount: 60 },
        _avg: { totalOrderAfterDiscount: 30 },
        _count: { id: 1 },
      })
      .mockResolvedValueOnce({
        _sum: { totalOrderAfterDiscount: 40 },
        _avg: { totalOrderAfterDiscount: 40 },
        _count: { id: 1 },
      });
    const prisma = { order: { aggregate } } as unknown as PrismaService;
    const service = new ReportRevenueService(
      prisma,
      new ReportDateRangeService(),
      new ReportFilterService(),
      new ReportPeriodService(),
      new ReportMapperService(new ReportSorterService())
    );

    await expect(
      service.get({
        reportDateMin: '05/02/2026',
        reportDateMax: '06/02/2026',
      })
    ).resolves.toEqual({
      grossProfit: 100,
      averageOrder: 50,
      numberOfOrders: 2,
      reports: [
        { label: '5/2', total: 60, avg: 30, count: 1 },
        { label: '6/2', total: 40, avg: 40, count: 1 },
      ],
    });

    expect(aggregate).toHaveBeenCalledTimes(3);
  });
});
