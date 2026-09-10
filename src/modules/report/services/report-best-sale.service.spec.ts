import { PrismaService } from 'src/prisma/prisma.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportBestSaleService } from './report-best-sale.service';
import { ReportSorterService } from './report-sorter.service';

describe('ReportBestSaleService', () => {
  it('returns the five highest-revenue products using the existing aggregate scope', async () => {
    const productFindMany = jest.fn().mockResolvedValue([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({
        _sum: { totalPriceAfterDiscount: 30, quantity: 2 },
      })
      .mockResolvedValueOnce({
        _sum: { totalPriceAfterDiscount: 100, quantity: 1 },
      });
    const prisma = {
      product: { findMany: productFindMany },
      orderItem: { aggregate },
    } as unknown as PrismaService;
    const service = new ReportBestSaleService(
      prisma,
      new ReportDateRangeService(),
      new ReportFilterService(),
      new ReportMapperService(new ReportSorterService())
    );

    await expect(
      service.get({
        reportDateMin: '05/02/2026',
        reportDateMax: '14/02/2026',
      })
    ).resolves.toEqual([
      { productName: 'B', quantity: 1, revenue: 100 },
      { productName: 'A', quantity: 2, revenue: 30 },
    ]);

    expect(aggregate.mock.calls[0][0].where).toEqual({
      productId: 1,
      order: {
        void: false,
        status: 'Đã hoàn thành',
      },
    });
  });
});
