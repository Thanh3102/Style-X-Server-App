import { Response } from 'express';
import { ReportBestSaleService } from './services/report-best-sale.service';
import { ReportLowStockService } from './services/report-low-stock.service';
import { ReportOverviewService } from './services/report-overview.service';
import { ReportProductRevenueService } from './services/report-product-revenue.service';
import { ReportRevenueDetailService } from './services/report-revenue-detail.service';
import { ReportRevenueService } from './services/report-revenue.service';
import { ReportService } from './report.service';

describe('ReportService', () => {
  it('keeps the HTTP response boundary in the public facade', async () => {
    const report = { grossProfit: 100 };
    const overview = {
      get: jest.fn().mockResolvedValue(report),
    } as unknown as ReportOverviewService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new ReportService(
      overview,
      {} as ReportRevenueService,
      {} as ReportRevenueDetailService,
      {} as ReportBestSaleService,
      {} as ReportLowStockService,
      {} as ReportProductRevenueService
    );

    await service.getOverviewReport({}, response);

    expect(overview.get).toHaveBeenCalledWith({});
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(report);
  });
});
