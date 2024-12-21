import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import { QueryParams } from 'src/utils/types';
import { ReportService } from './report.service';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('report')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get('/overview')
  getOverviewReport(@Query() queryParams: QueryParams, @Res() res) {
    return this.reportService.getOverviewReport(queryParams, res);
  }

  @Get('/revenue')
  getRevenueReport(@Query() queryParams: QueryParams, @Res() res) {
    return this.reportService.getRevenueReport(queryParams, res);
  }

  @Get('/detail/revenue')
  getRevenueDetailReport(@Query() queryParams: QueryParams, @Res() res) {
    return this.reportService.getRevenueDetailReport(queryParams, res);
  }

  @Get('/detail/product')
  getProductRevenueDetailReport(@Query() queryParams: QueryParams, @Res() res) {
    return this.reportService.getProductRevenueDetailReport(queryParams, res);
  }

  @Get('/best-sale')
  getBestSale(@Query() queryParams: QueryParams, @Res() res) {
    return this.reportService.getBestSaleReport(queryParams, res);
  }

  @Get('/low-stock')
  getLowStock(@Res() res) {
    return this.reportService.getLowStockReport(res);
  }
}
