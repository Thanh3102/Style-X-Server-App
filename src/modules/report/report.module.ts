import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportBestSaleService } from './services/report-best-sale.service';
import { ReportCalculationService } from './services/report-calculation.service';
import { ReportDateRangeService } from './services/report-date-range.service';
import { ReportFilterService } from './services/report-filter.service';
import { ReportLowStockService } from './services/report-low-stock.service';
import { ReportMapperService } from './services/report-mapper.service';
import { ReportOverviewService } from './services/report-overview.service';
import { ReportPeriodService } from './services/report-period.service';
import { ReportProductRevenueService } from './services/report-product-revenue.service';
import { ReportRevenueDetailService } from './services/report-revenue-detail.service';
import { ReportRevenueService } from './services/report-revenue.service';
import { ReportSorterService } from './services/report-sorter.service';

@Module({
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportBestSaleService,
    ReportCalculationService,
    ReportDateRangeService,
    ReportFilterService,
    ReportLowStockService,
    ReportMapperService,
    ReportOverviewService,
    ReportPeriodService,
    ReportProductRevenueService,
    ReportRevenueDetailService,
    ReportRevenueService,
    ReportSorterService,
  ],
  exports: [ReportService],
})
export class ReportModule {}
