import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportLowStock } from '../report.type';
import { ReportMapperService } from './report-mapper.service';

@Injectable()
export class ReportLowStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ReportMapperService
  ) {}

  async get(): Promise<ReportLowStock> {
    const productVariants = await this.prisma.productVariants.findMany({
      select: {
        id: true,
        title: true,
        skuCode: true,
        barCode: true,
        product: {
          select: {
            id: true,
            skuCode: true,
            barCode: true,
            name: true,
            vendor: true,
            type: true,
          },
        },
        inventories: {
          select: {
            id: true,
            onHand: true,
            warehouse: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return this.mapper.lowStock(productVariants);
  }
}
