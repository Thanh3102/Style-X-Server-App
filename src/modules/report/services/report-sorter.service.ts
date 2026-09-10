import { Injectable } from '@nestjs/common';
import {
  ReportBestSale,
  ReportLowStock,
  ReportProductRevenueDetailResponse,
} from '../report.type';

@Injectable()
export class ReportSorterService {
  bestSale(data: ReportBestSale): ReportBestSale {
    return data
      .slice()
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  lowStock(data: ReportLowStock): ReportLowStock {
    return data.slice().sort((a, b) => a.onHand - b.onHand);
  }

  productRevenueDetail(
    data: ReportProductRevenueDetailResponse
  ): ReportProductRevenueDetailResponse {
    return data.slice().sort((a, b) => b.totalNetRevenue - a.totalNetRevenue);
  }
}
