import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { QueryParams } from 'src/utils/types';
import { ReportBestSaleService } from './services/report-best-sale.service';
import { ReportLowStockService } from './services/report-low-stock.service';
import { ReportOverviewService } from './services/report-overview.service';
import { ReportProductRevenueService } from './services/report-product-revenue.service';
import { ReportRevenueDetailService } from './services/report-revenue-detail.service';
import { ReportRevenueService } from './services/report-revenue.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly overviewService: ReportOverviewService,
    private readonly revenueService: ReportRevenueService,
    private readonly revenueDetailService: ReportRevenueDetailService,
    private readonly bestSaleService: ReportBestSaleService,
    private readonly lowStockService: ReportLowStockService,
    private readonly productRevenueService: ReportProductRevenueService
  ) {}

  async getOverviewReport(
    params: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      return res.status(200).json(await this.overviewService.get(params));
    } catch (error: unknown) {
      return this.errorResponse(res, error, 'Đã có lỗi xảy ra');
    }
  }

  async getRevenueReport(
    params: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      return res.status(200).json(await this.revenueService.get(params));
    } catch (error: unknown) {
      return this.errorResponse(res, error, 'Đã có lỗi xảy ra');
    }
  }

  async getRevenueDetailReport(
    params: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      return res.status(200).json(await this.revenueDetailService.get(params));
    } catch (error: unknown) {
      return this.errorResponse(res, error, 'Đã có lỗi xảy ra');
    }
  }

  async getProductRevenueDetailReport(
    params: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      return res.status(200).json(await this.productRevenueService.get(params));
    } catch (error: unknown) {
      return this.errorResponse(res, error, 'Đã có lỗi xảy ra');
    }
  }

  async getBestSaleReport(
    params: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      return res.status(200).json(await this.bestSaleService.get(params));
    } catch (error: unknown) {
      return this.errorResponse(res, error, 'Đã có lỗi xảy ra');
    }
  }

  async getLowStockReport(res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.lowStockService.get());
    } catch (error: unknown) {
      return this.errorResponse(res, error, 'Đã xảy ra lỗi');
    }
  }

  private errorResponse(
    res: Response,
    error: unknown,
    message: string
  ): Response {
    this.logError(error);
    return res.status(500).json({ message });
  }

  private logError(error: unknown): void {
    if (error instanceof Error) {
      this.logger.error(error.stack ?? error.message);
      return;
    }

    this.logger.error(String(error));
  }
}
