import { PrismaService } from 'src/prisma/prisma.service';
import { ReportCalculationService } from './report-calculation.service';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportOverviewService } from './report-overview.service';
import { ReportSorterService } from './report-sorter.service';

describe('ReportOverviewService', () => {
  it('keeps overview totals based on completed orders and inventory costs', async () => {
    const orderAggregate = jest.fn().mockResolvedValue({
      _avg: { totalOrderAfterDiscount: 250 },
      _sum: { totalOrderAfterDiscount: 500 },
      _count: { id: 2 },
    });
    const productVariantsFindMany = jest.fn().mockResolvedValue([
      {
        costPrice: 10,
        receiveItems: [
          {
            finalTotal: 24,
            finalPrice: 12,
            quantityReceived: 2,
            quantityAvaiable: 2,
          },
        ],
        inventories: [{ avaiable: 5 }],
      },
    ]);
    const orderItemFindMany = jest
      .fn()
      .mockResolvedValue([{ sources: [{ costPrice: 8, quantity: 3 }] }]);
    const prisma = {
      order: { aggregate: orderAggregate },
      productVariants: { findMany: productVariantsFindMany },
      orderItem: { findMany: orderItemFindMany },
    } as unknown as PrismaService;
    const service = new ReportOverviewService(
      prisma,
      new ReportDateRangeService(),
      new ReportFilterService(),
      new ReportCalculationService(),
      new ReportMapperService(new ReportSorterService())
    );

    await expect(
      service.get({
        reportDateMin: '05/02/2026',
        reportDateMax: '14/02/2026',
      })
    ).resolves.toEqual({
      grossProfit: 500,
      inventoryValue: 54,
      netRevenue: 476,
      numberOfOrders: 2,
    });

    expect(orderAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          void: false,
          status: 'Đã hoàn thành',
          createdAt: {
            gte: new Date('2026-02-05'),
            lte: new Date('2026-02-14'),
          },
        },
      })
    );
  });
});
