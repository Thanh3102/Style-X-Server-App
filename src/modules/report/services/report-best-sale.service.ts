import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';
import { ReportBestSale } from '../report.type';
import { ReportDateRangeService } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';
import { ReportMapperService } from './report-mapper.service';

@Injectable()
export class ReportBestSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateRangeService: ReportDateRangeService,
    private readonly filterService: ReportFilterService,
    private readonly mapper: ReportMapperService
  ) {}

  async get(params: QueryParams): Promise<ReportBestSale> {
    const range = this.dateRangeService.resolve(params);
    const products = await this.prisma.product.findMany({
      where: this.filterService.productWithCompletedOrders(range),
      select: {
        id: true,
        name: true,
      },
      distinct: ['id'],
    });
    const productSales: ReportBestSale = [];

    for (const product of products) {
      const aggregate = await this.prisma.orderItem.aggregate({
        where: {
          productId: product.id,
          order: this.filterService.completedOrder(),
        },
        _sum: {
          totalPriceAfterDiscount: true,
          quantity: true,
        },
      });

      productSales.push({
        productName: product.name,
        quantity: aggregate._sum.quantity,
        revenue: aggregate._sum.totalPriceAfterDiscount,
      });
    }

    return this.mapper.bestSale(productSales);
  }
}
