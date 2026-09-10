import { Injectable } from '@nestjs/common';
import {
  ReportBestSale,
  ReportLowStock,
  ReportOverviewResponse,
  ReportProductRevenueDetailResponse,
  ReportRevenueDetailResponse,
  ReportRevenueResponse,
} from '../report.type';
import { ReportSorterService } from './report-sorter.service';

export type ReportOverviewMetrics = {
  grossProfit: number;
  inventoryValue: number;
  totalCostPrice: number;
  numberOfOrders: number;
};

export type ReportRevenueMetrics = {
  grossProfit: number;
  averageOrder: number;
  numberOfOrders: number;
  reports: ReportRevenueResponse['reports'];
};

export type ReportRevenueDetailMetrics = {
  reports: ReportRevenueDetailResponse['reports'];
  totalAverageOrderValue: number;
  totalCost: number;
  totalDiscount: number;
  totalGoodValue: number;
  totalGrossProfit: number;
  totalNetRevenue: number;
  totalNumberOfOrderItem: number;
  totalNumberOfOrder: number;
};

export type ReportLowStockVariant = {
  id: number;
  title: string;
  skuCode: string;
  barCode: string;
  product: {
    id: number;
    name: string;
    vendor: string;
    type: string;
  };
  inventories: Array<{
    id: number;
    onHand: number;
    warehouse: {
      id: number;
      name: string;
    };
  }>;
};

@Injectable()
export class ReportMapperService {
  constructor(private readonly sorter: ReportSorterService) {}

  overview(metrics: ReportOverviewMetrics): ReportOverviewResponse {
    return {
      grossProfit: metrics.grossProfit,
      inventoryValue: metrics.inventoryValue,
      netRevenue: metrics.grossProfit - metrics.totalCostPrice,
      numberOfOrders: metrics.numberOfOrders,
    };
  }

  revenue(metrics: ReportRevenueMetrics): ReportRevenueResponse {
    return {
      grossProfit: metrics.grossProfit,
      averageOrder: metrics.averageOrder,
      numberOfOrders: metrics.numberOfOrders,
      reports: metrics.reports,
    };
  }

  revenueDetail(
    metrics: ReportRevenueDetailMetrics
  ): ReportRevenueDetailResponse {
    return {
      reports: metrics.reports,
      totalAverageOrderValue: metrics.totalAverageOrderValue,
      totalCost: metrics.totalCost,
      totalDiscount: metrics.totalDiscount,
      totalGoodValue: metrics.totalGoodValue,
      totalGrossProfit: metrics.totalGrossProfit,
      totalNetRevenue: metrics.totalNetRevenue,
      totalNumberOfOrderItem: metrics.totalNumberOfOrderItem,
      totalNumberOfOrder: metrics.totalNumberOfOrder,
    };
  }

  bestSale(data: ReportBestSale): ReportBestSale {
    return this.sorter.bestSale(data);
  }

  productRevenueDetail(
    data: ReportProductRevenueDetailResponse
  ): ReportProductRevenueDetailResponse {
    return this.sorter.productRevenueDetail(data);
  }

  lowStock(variants: ReportLowStockVariant[], minStock = 30): ReportLowStock {
    const report = variants.reduce<ReportLowStock>((result, variant) => {
      const warehouses = variant.inventories.map((inventory) => ({
        id: inventory.warehouse.id,
        name: inventory.warehouse.name,
        onHand: inventory.onHand,
      }));
      const onHand = warehouses.reduce(
        (total, warehouse) => total + warehouse.onHand,
        0
      );

      if (onHand < minStock) {
        result.push({
          onHand,
          product: {
            id: variant.product.id,
            name: variant.product.name,
            type: variant.product.type,
            vendor: variant.product.vendor,
          },
          variant: {
            id: variant.id,
            barCode: variant.barCode,
            skuCode: variant.skuCode,
            title: variant.title,
          },
          warehouses,
        });
      }

      return result;
    }, []);

    return this.sorter.lowStock(report);
  }
}
