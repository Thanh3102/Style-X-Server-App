import { ReportSorterService } from './report-sorter.service';

describe('ReportSorterService', () => {
  it('sorts best-sale data by revenue and keeps only the top five entries', () => {
    const service = new ReportSorterService();
    const sales = Array.from({ length: 6 }, (_, index) => ({
      productName: `Product ${index}`,
      quantity: 1,
      revenue: index,
    }));

    expect(service.bestSale(sales).map((item) => item.revenue)).toEqual([
      5, 4, 3, 2, 1,
    ]);
  });

  it('sorts low-stock and product-detail data in their public order', () => {
    const service = new ReportSorterService();
    const lowStock = [{ onHand: 12 }, { onHand: 2 }, { onHand: 7 }] as never[];
    const productDetails = [
      { totalNetRevenue: 12 },
      { totalNetRevenue: 40 },
      { totalNetRevenue: 5 },
    ] as never[];

    expect(service.lowStock(lowStock).map((item) => item.onHand)).toEqual([
      2, 7, 12,
    ]);
    expect(
      service
        .productRevenueDetail(productDetails)
        .map((item) => item.totalNetRevenue)
    ).toEqual([40, 12, 5]);
  });
});
