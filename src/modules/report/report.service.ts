import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { DateFilterOptionValue, QueryParams } from 'src/utils/types';
import { OrderStatus } from '../order/order.type';
import {
  ReportBestSale,
  ReportLowStock,
  ReportOverviewResponse,
  ReportProductRevenueDetailResponse,
  ReportRevenueDetailResponse,
  ReportRevenueResponse,
} from './report.type';
import { Prisma } from '@prisma/client';
import {
  getLastMonthStartEnd,
  getLastWeekStartEnd,
  getLastYearStartEnd,
  getPreviousDay,
  getThisMonthStartEnd,
  getThisWeekStartEnd,
  getThisYearStartEnd,
  getToday,
} from 'src/utils/helper/DateHelper';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async getOverviewReport(params: QueryParams, res: Response) {
    const { reportDate, reportDateMax, reportDateMin } = params;

    const whereInput: Prisma.OrderWhereInput = {
      void: false,
      status: OrderStatus.COMPLETE,
    };

    let startDate = undefined;
    let endDate = undefined;

    switch (reportDate as DateFilterOptionValue) {
      case DateFilterOptionValue.TODAY:
        startDate = getToday();
        endDate = new Date(getToday().setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.YESTERDAY:
        startDate = getPreviousDay(1);
        endDate = new Date(getPreviousDay(1).setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.DAY_LAST_7:
        startDate = getPreviousDay(6);
        endDate = new Date(getToday().setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.DAY_LAST_30:
        startDate = getPreviousDay(30);
        endDate = new Date(getToday().setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.THIS_WEEK:
        const thisWeek = getThisWeekStartEnd();

        (startDate = thisWeek.start),
          (endDate = new Date(thisWeek.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.LAST_WEEK:
        const lastWeek = getLastWeekStartEnd();

        (startDate = lastWeek.start),
          (endDate = new Date(lastWeek.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.THIS_MONTH:
        const thisMonth = getThisMonthStartEnd();

        (startDate = thisMonth.start),
          (endDate = new Date(thisMonth.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.LAST_MONTH:
        const lastMonth = getLastMonthStartEnd();

        (startDate = lastMonth.start),
          (endDate = new Date(lastMonth.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.THIS_YEAR:
        const thisYear = getThisYearStartEnd();

        (startDate = thisYear.start),
          (endDate = new Date(thisYear.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.LAST_YEAR:
        const lastYear = getLastYearStartEnd();

        (startDate = lastYear.start),
          (endDate = new Date(lastYear.end.setHours(23, 59, 59)));
        break;
    }

    whereInput.createdAt = {
      gte: startDate,
      lte: endDate,
    };

    if (reportDateMin) {
      const [day, month, year] = reportDateMin.split('/');
      const minDate = new Date(`${year}-${month}-${day}`);
      startDate = minDate;
      whereInput.createdAt.gte = minDate;
    }

    if (reportDateMax) {
      const [day, month, year] = reportDateMax.split('/');
      const maxDate = new Date(`${year}-${month}-${day}`);
      endDate = maxDate;
      whereInput.createdAt.lte = maxDate;
    }

    try {
      const orderAggregate = await this.prisma.order.aggregate({
        _avg: {
          totalOrderAfterDiscount: true,
        },
        _sum: {
          totalOrderAfterDiscount: true,
        },
        _count: {
          id: true,
        },

        where: whereInput,
      });

      //   const variantAggregate = await this.prisma.orderItem.groupBy({
      //     by: ['variantId'],
      //     where: {
      //       order: whereInput,
      //     },
      //     _sum: {
      //       totalPriceAfterDiscount: true,
      //     },
      //   });

      const variants = await this.prisma.productVariants.findMany({
        where: {
          void: false,
        },
        select: {
          costPrice: true,
          receiveItems: {
            select: {
              finalTotal: true,
              finalPrice: true,
              quantityReceived: true,
              quantityAvaiable: true,
            },
          },
          inventories: {
            select: {
              avaiable: true,
            },
          },
        },
      });

      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          order: whereInput,
        },
        select: {
          sources: {
            select: {
              costPrice: true,
              quantity: true,
            },
          },
        },
      });

      const inventoryValue = variants.reduce((total, item) => {
        let totalReceive = 0;

        let inventoryQuantityLeft = item.inventories.reduce((total, item) => {
          return total + item.avaiable;
        }, 0);

        for (const receive of item.receiveItems) {
          (totalReceive += receive.finalPrice * receive.quantityAvaiable),
            (inventoryQuantityLeft -= receive.quantityAvaiable);
        }

        return total + totalReceive + inventoryQuantityLeft * item.costPrice;
      }, 0);

      const totalCostPrice = orderItems.reduce((total, item) => {
        let cost = 0;
        for (const source of item.sources) {
          cost += source.quantity * source.costPrice;
        }
        return total + cost;
      }, 0);

      // Doanh thu thuần = Giá bán - Khuyến mại
      const grossProfit = orderAggregate._sum.totalOrderAfterDiscount ?? 0;
      // Số đơn hàng
      const numberOfOrders = orderAggregate._count.id;
      // Lợi nhuận gộp = Doanh thu thuần - giá vốn
      const netRevenue = grossProfit - totalCostPrice;

      const response: ReportOverviewResponse = {
        grossProfit: grossProfit,
        inventoryValue: inventoryValue,
        netRevenue: netRevenue,
        numberOfOrders: numberOfOrders,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
  }

  async getRevenueReport(params: QueryParams, res: Response) {
    const { reportDate, reportDateMax, reportDateMin } = params;

    const whereInput: Prisma.OrderWhereInput = {
      void: false,
      status: OrderStatus.COMPLETE,
    };

    let startDate: Date = undefined;
    let endDate: Date = undefined;

    switch (reportDate as DateFilterOptionValue) {
      case DateFilterOptionValue.TODAY:
        startDate = getToday();
        endDate = new Date(getToday().setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.YESTERDAY:
        startDate = getPreviousDay(1);
        endDate = new Date(getPreviousDay(1).setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.DAY_LAST_7:
        startDate = getPreviousDay(6);
        endDate = new Date(getToday().setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.DAY_LAST_30:
        startDate = getPreviousDay(30);
        endDate = new Date(getToday().setHours(23, 59, 59));
        break;

      case DateFilterOptionValue.THIS_WEEK:
        const thisWeek = getThisWeekStartEnd();

        (startDate = thisWeek.start),
          (endDate = new Date(thisWeek.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.LAST_WEEK:
        const lastWeek = getLastWeekStartEnd();

        (startDate = lastWeek.start),
          (endDate = new Date(lastWeek.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.THIS_MONTH:
        const thisMonth = getThisMonthStartEnd();

        (startDate = thisMonth.start),
          (endDate = new Date(thisMonth.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.LAST_MONTH:
        const lastMonth = getLastMonthStartEnd();

        (startDate = lastMonth.start),
          (endDate = new Date(lastMonth.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.THIS_YEAR:
        const thisYear = getThisYearStartEnd();

        (startDate = thisYear.start),
          (endDate = new Date(thisYear.end.setHours(23, 59, 59)));
        break;

      case DateFilterOptionValue.LAST_YEAR:
        const lastYear = getLastYearStartEnd();

        (startDate = lastYear.start),
          (endDate = new Date(lastYear.end.setHours(23, 59, 59)));
        break;
    }

    whereInput.createdAt = {
      gte: startDate,
      lte: endDate,
    };

    if (reportDateMin) {
      const [day, month, year] = reportDateMin.split('/');
      const minDate = new Date(`${year}-${month}-${day}`);
      startDate = minDate;
      whereInput.createdAt.gte = minDate;
    }

    if (reportDateMax) {
      const [day, month, year] = reportDateMax.split('/');
      const maxDate = new Date(`${year}-${month}-${day}`);
      endDate = maxDate;
      whereInput.createdAt.lte = maxDate;
    }

    try {
      const orderAggregate = await this.prisma.order.aggregate({
        _sum: {
          totalOrderAfterDiscount: true,
        },
        _avg: {
          totalOrderAfterDiscount: true,
        },
        _count: {
          id: true,
        },
        where: whereInput,
      });

      const grossProfit = orderAggregate._sum.totalOrderAfterDiscount ?? 0;
      const averageOrder = orderAggregate._avg.totalOrderAfterDiscount ?? 0;
      const numberOfOrders = orderAggregate._count.id ?? 0;

      const reportData: ReportRevenueResponse['reports'] = [];

      if (
        reportDate === DateFilterOptionValue.THIS_YEAR ||
        reportDate === DateFilterOptionValue.LAST_YEAR
      ) {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const startOfMonth = new Date(currentDate);
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const endOfMonth = new Date(currentDate);
          endOfMonth.setMonth(endOfMonth.getMonth() + 1);
          endOfMonth.setDate(0);
          endOfMonth.setHours(23, 59, 59, 999);

          const {
            _sum: { totalOrderAfterDiscount: totalSum },
            _avg: { totalOrderAfterDiscount: totalAvg },
            _count: { id: countId },
          } = await this.prisma.order.aggregate({
            where: {
              void: false,
              status: OrderStatus.COMPLETE,
              createdAt: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            _sum: {
              totalOrderAfterDiscount: true,
            },
            _avg: {
              totalOrderAfterDiscount: true,
            },
            _count: {
              id: true,
            },
          });

          const [d, m, y] = Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
          })
            .format(currentDate)
            .split('/');

          reportData.push({
            label: `Tháng ${m}`,
            total: totalSum ?? 0,
            avg: totalAvg ?? 0,
            count: countId ?? 0,
          });

          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      } else {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const startOfDay = new Date(currentDate);
          startOfDay.setHours(0, 0, 0, 0);

          // Lấy ngày kết thúc (23:59:59)
          const endOfDay = new Date(currentDate);
          endOfDay.setHours(23, 59, 59, 999);

          const {
            _sum: { totalOrderAfterDiscount: totalSum },
            _avg: { totalOrderAfterDiscount: totalAvg },
            _count: { id: countId },
          } = await this.prisma.order.aggregate({
            where: {
              void: false,
              status: OrderStatus.COMPLETE,
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
            _sum: {
              totalOrderAfterDiscount: true,
            },
            _avg: {
              totalOrderAfterDiscount: true,
            },
            _count: {
              id: true,
            },
          });

          const [d, m, y] = Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
          })
            .format(currentDate)
            .split('/');

          reportData.push({
            label: `${d}/${m}`,
            total: totalSum ?? 0,
            avg: totalAvg ?? 0,
            count: countId,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      const response: ReportRevenueResponse = {
        grossProfit: grossProfit,
        averageOrder: averageOrder,
        numberOfOrders: numberOfOrders,
        reports: reportData,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
  }

  async getBestSaleReport(params: QueryParams, res: Response) {
    try {
      const { reportDate, reportDateMax, reportDateMin } = params;

      const whereInput: Prisma.ProductWhereInput = {
        orderItems: {
          some: {
            order: {
              void: false,
              status: OrderStatus.COMPLETE,
            },
          },
        },
      };

      let startDate: Date = undefined;
      let endDate: Date = undefined;

      switch (reportDate as DateFilterOptionValue) {
        case DateFilterOptionValue.TODAY:
          startDate = getToday();
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.YESTERDAY:
          startDate = getPreviousDay(1);
          endDate = new Date(getPreviousDay(1).setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.DAY_LAST_7:
          startDate = getPreviousDay(6);
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.DAY_LAST_30:
          startDate = getPreviousDay(30);
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.THIS_WEEK:
          const thisWeek = getThisWeekStartEnd();

          (startDate = thisWeek.start),
            (endDate = new Date(thisWeek.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_WEEK:
          const lastWeek = getLastWeekStartEnd();

          (startDate = lastWeek.start),
            (endDate = new Date(lastWeek.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.THIS_MONTH:
          const thisMonth = getThisMonthStartEnd();

          (startDate = thisMonth.start),
            (endDate = new Date(thisMonth.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_MONTH:
          const lastMonth = getLastMonthStartEnd();

          (startDate = lastMonth.start),
            (endDate = new Date(lastMonth.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.THIS_YEAR:
          const thisYear = getThisYearStartEnd();

          (startDate = thisYear.start),
            (endDate = new Date(thisYear.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_YEAR:
          const lastYear = getLastYearStartEnd();

          (startDate = lastYear.start),
            (endDate = new Date(lastYear.end.setHours(23, 59, 59)));
          break;
      }

      whereInput.orderItems.some.order.createdAt = {
        gte: startDate,
        lte: endDate,
      };

      if (reportDateMin) {
        const [day, month, year] = reportDateMin.split('/');
        const minDate = new Date(`${year}-${month}-${day}`);
        startDate = minDate;
        whereInput.orderItems.some.order.createdAt.gte = minDate;
      }

      if (reportDateMax) {
        const [day, month, year] = reportDateMax.split('/');
        const maxDate = new Date(`${year}-${month}-${day}`);
        endDate = maxDate;
        whereInput.orderItems.some.order.createdAt.lte = maxDate;
      }

      const products = await this.prisma.product.findMany({
        where: whereInput,
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
            order: {
              void: false,
              status: OrderStatus.COMPLETE,
            },
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

      const sortProductSale = productSales.sort(
        (a, b) => b.revenue - a.revenue,
      );

      const repsonseData = sortProductSale.slice(0, 5);

      return res.status(200).json(repsonseData);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
  }

  async getLowStockReport(res: Response) {
    const minStock = 30;
    try {
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

      const lowStockReport: ReportLowStock = [];

      for (const variant of productVariants) {
        let totalOnHand = 0;
        let warehouses: ReportLowStock[0]['warehouses'] = [];
        for (const inven of variant.inventories) {
          totalOnHand += inven.onHand;
          warehouses.push({
            id: inven.warehouse.id,
            name: inven.warehouse.name,
            onHand: inven.onHand,
          });
        }

        if (totalOnHand < minStock) {
          lowStockReport.push({
            onHand: totalOnHand,
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
            warehouses: warehouses,
          });
        }
      }

      const responseData = lowStockReport.sort((a, b) => a.onHand - b.onHand);

      return res.status(200).json(lowStockReport);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getRevenueDetailReport(params: QueryParams, res: Response) {
    try {
      const { reportDate, reportDateMax, reportDateMin } = params;

      const whereInput: Prisma.OrderWhereInput = {
        void: false,
        status: OrderStatus.COMPLETE,
      };

      let startDate: Date = undefined;
      let endDate: Date = undefined;

      switch (reportDate as DateFilterOptionValue) {
        case DateFilterOptionValue.TODAY:
          startDate = getToday();
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.YESTERDAY:
          startDate = getPreviousDay(1);
          endDate = new Date(getPreviousDay(1).setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.DAY_LAST_7:
          startDate = getPreviousDay(6);
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.DAY_LAST_30:
          startDate = getPreviousDay(30);
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.THIS_WEEK:
          const thisWeek = getThisWeekStartEnd();

          (startDate = thisWeek.start),
            (endDate = new Date(thisWeek.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_WEEK:
          const lastWeek = getLastWeekStartEnd();

          (startDate = lastWeek.start),
            (endDate = new Date(lastWeek.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.THIS_MONTH:
          const thisMonth = getThisMonthStartEnd();

          (startDate = thisMonth.start),
            (endDate = new Date(thisMonth.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_MONTH:
          const lastMonth = getLastMonthStartEnd();

          (startDate = lastMonth.start),
            (endDate = new Date(lastMonth.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.THIS_YEAR:
          const thisYear = getThisYearStartEnd();

          (startDate = thisYear.start),
            (endDate = new Date(thisYear.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_YEAR:
          const lastYear = getLastYearStartEnd();

          (startDate = lastYear.start),
            (endDate = new Date(lastYear.end.setHours(23, 59, 59)));
          break;
        default:
          startDate = getToday();
          endDate = new Date(getToday().setHours(23, 59, 59));
      }

      whereInput.createdAt = {
        gte: startDate,
        lte: endDate,
      };

      if (reportDateMin) {
        const [day, month, year] = reportDateMin.split('/');
        const minDate = new Date(`${year}-${month}-${day}`);
        startDate = minDate;
        whereInput.createdAt.gte = minDate;
      }

      if (reportDateMax) {
        const [day, month, year] = reportDateMax.split('/');
        const maxDate = new Date(`${year}-${month}-${day}`);
        endDate = maxDate;
        whereInput.createdAt.lte = maxDate;
      }

      let totalNumberOfOrder = 0;
      let totalNumberOfOrderItem = 0;
      let totalGoodValue = 0;
      let totalDiscount = 0;
      let totalNetRevenue = 0;
      let totalGrossProfit = 0;
      let totalAverageOrderValue = 0;
      let totalCost = 0;

      const reportData: ReportRevenueDetailResponse['reports'] = [];

      if (
        reportDate === DateFilterOptionValue.THIS_YEAR ||
        reportDate === DateFilterOptionValue.LAST_YEAR
      ) {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const startOfMonth = new Date(currentDate);
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const endOfMonth = new Date(currentDate);
          endOfMonth.setMonth(endOfMonth.getMonth() + 1);
          endOfMonth.setDate(0);
          endOfMonth.setHours(23, 59, 59, 999);

          const {
            _sum: {
              totalOrderBeforeDiscount: GoodValue,
              totalOrderAfterDiscount: NetRevenue,
              totalOrderDiscountAmount: Discount,
            },
            _avg: { totalOrderAfterDiscount: AverageOrderValue },
            _count: { id: NumberOfOrder },
          } = await this.prisma.order.aggregate({
            where: {
              void: false,
              status: OrderStatus.COMPLETE,
              createdAt: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            _sum: {
              totalOrderAfterDiscount: true,
              totalOrderBeforeDiscount: true,
              totalOrderDiscountAmount: true,
            },
            _avg: {
              totalOrderAfterDiscount: true,
            },
            _count: {
              id: true,
            },
          });

          const orderItems = await this.prisma.orderItem.findMany({
            where: {
              order: {
                ...whereInput,
                createdAt: {
                  gte: startOfMonth,
                  lte: endOfMonth,
                },
              },
            },
            select: {
              quantity: true,
              sources: {
                select: {
                  costPrice: true,
                  quantity: true,
                },
              },
            },
          });

          // Tổng số sản phẩm
          let NumberOfOrderItem = 0;
          // Tổng giá vốn
          const totalCostPrice = orderItems.reduce((total, item) => {
            NumberOfOrderItem += item.quantity;
            let cost = 0;
            for (const source of item.sources) {
              cost += source.quantity * source.costPrice;
            }
            return total + cost;
          }, 0);

          totalNumberOfOrder += NumberOfOrder;
          totalNumberOfOrderItem += NumberOfOrderItem;
          totalGoodValue += GoodValue;
          totalDiscount += Discount;
          totalNetRevenue += NetRevenue;
          totalGrossProfit += NetRevenue - totalCostPrice;
          totalAverageOrderValue += AverageOrderValue;
          totalCost += totalCostPrice;

          const [d, m, y] = Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
          })
            .format(currentDate)
            .split('/');

          reportData.push({
            label: `Tháng ${m}`,
            time: `T${m}/20${y}`,
            averageOrderValue: AverageOrderValue,
            cost: totalCostPrice,
            discount: Discount,
            goodValue: GoodValue,
            grossProfit: NetRevenue - totalCostPrice,
            netRevenue: NetRevenue,
            numberOfOrder: NumberOfOrder,
            numberOfOrderItem: NumberOfOrderItem,
          });

          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      } else {
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const startOfDay = new Date(currentDate);
          startOfDay.setHours(0, 0, 0, 0);

          // Lấy ngày kết thúc (23:59:59)
          const endOfDay = new Date(currentDate);
          endOfDay.setHours(23, 59, 59, 999);

          const {
            _sum: {
              totalOrderBeforeDiscount: GoodValue,
              totalOrderAfterDiscount: NetRevenue,
              totalOrderDiscountAmount: Discount,
            },
            _avg: { totalOrderAfterDiscount: AverageOrderValue },
            _count: { id: NumberOfOrder },
          } = await this.prisma.order.aggregate({
            where: {
              void: false,
              status: OrderStatus.COMPLETE,
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
            _sum: {
              totalOrderAfterDiscount: true,
              totalOrderBeforeDiscount: true,
              totalOrderDiscountAmount: true,
            },
            _avg: {
              totalOrderAfterDiscount: true,
            },
            _count: {
              id: true,
            },
          });

          const orderItems = await this.prisma.orderItem.findMany({
            where: {
              order: {
                ...whereInput,
                createdAt: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
            },
            select: {
              quantity: true,
              sources: {
                select: {
                  costPrice: true,
                  quantity: true,
                },
              },
            },
          });

          // Tổng số sản phẩm
          let NumberOfOrderItem = 0;
          // Tổng giá vốn
          const totalCostPrice = orderItems.reduce((total, item) => {
            NumberOfOrderItem += item.quantity;
            let cost = 0;
            for (const source of item.sources) {
              cost += source.quantity * source.costPrice;
            }
            return total + cost;
          }, 0);

          totalNumberOfOrder += NumberOfOrder;
          totalNumberOfOrderItem += NumberOfOrderItem;
          totalGoodValue += GoodValue;
          totalDiscount += Discount;
          totalNetRevenue += NetRevenue;
          totalGrossProfit += NetRevenue - totalCostPrice;
          totalAverageOrderValue += AverageOrderValue;
          totalCost += totalCostPrice;

          const [d, m, y] = Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
          })
            .format(currentDate)
            .split('/');

          reportData.push({
            time: `${d}/${m}/20${y}`,
            label: `${d}/${m}`,
            averageOrderValue: AverageOrderValue,
            cost: totalCostPrice,
            discount: Discount,
            goodValue: GoodValue,
            grossProfit: NetRevenue - totalCostPrice,
            netRevenue: NetRevenue,
            numberOfOrder: NumberOfOrder,
            numberOfOrderItem: NumberOfOrderItem,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      const response: ReportRevenueDetailResponse = {
        reports: reportData,
        totalAverageOrderValue: totalAverageOrderValue,
        totalCost: totalCost,
        totalDiscount: totalDiscount,
        totalGoodValue: totalGoodValue,
        totalGrossProfit: totalGrossProfit,
        totalNetRevenue: totalNetRevenue,
        totalNumberOfOrderItem: totalNumberOfOrderItem,
        totalNumberOfOrder: totalNumberOfOrder,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
  }

  async getProductRevenueDetailReport(params: QueryParams, res: Response) {
    try {
      const { reportDate, reportDateMax, reportDateMin } = params;

      const whereInput: Prisma.OrderWhereInput = {
        void: false,
        status: OrderStatus.COMPLETE,
      };

      let startDate: Date = undefined;
      let endDate: Date = undefined;

      switch (reportDate as DateFilterOptionValue) {
        case DateFilterOptionValue.TODAY:
          startDate = getToday();
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.YESTERDAY:
          startDate = getPreviousDay(1);
          endDate = new Date(getPreviousDay(1).setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.DAY_LAST_7:
          startDate = getPreviousDay(6);
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.DAY_LAST_30:
          startDate = getPreviousDay(30);
          endDate = new Date(getToday().setHours(23, 59, 59));
          break;

        case DateFilterOptionValue.THIS_WEEK:
          const thisWeek = getThisWeekStartEnd();

          (startDate = thisWeek.start),
            (endDate = new Date(thisWeek.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_WEEK:
          const lastWeek = getLastWeekStartEnd();

          (startDate = lastWeek.start),
            (endDate = new Date(lastWeek.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.THIS_MONTH:
          const thisMonth = getThisMonthStartEnd();

          (startDate = thisMonth.start),
            (endDate = new Date(thisMonth.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_MONTH:
          const lastMonth = getLastMonthStartEnd();

          (startDate = lastMonth.start),
            (endDate = new Date(lastMonth.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.THIS_YEAR:
          const thisYear = getThisYearStartEnd();

          (startDate = thisYear.start),
            (endDate = new Date(thisYear.end.setHours(23, 59, 59)));
          break;

        case DateFilterOptionValue.LAST_YEAR:
          const lastYear = getLastYearStartEnd();
          (startDate = lastYear.start),
            (endDate = new Date(lastYear.end.setHours(23, 59, 59)));
          break;

        default:
          startDate = getToday();
          endDate = new Date(getToday().setHours(23, 59, 59));
      }

      whereInput.createdAt = {
        gte: startDate,
        lte: endDate,
      };

      if (reportDateMin) {
        const [day, month, year] = reportDateMin.split('/');
        const minDate = new Date(`${year}-${month}-${day}`);
        startDate = minDate;
        whereInput.createdAt.gte = minDate;
      }

      if (reportDateMax) {
        const [day, month, year] = reportDateMax.split('/');
        const maxDate = new Date(`${year}-${month}-${day}`);
        endDate = maxDate;
        whereInput.createdAt.lte = maxDate;
      }

      const response: ReportProductRevenueDetailResponse = [];

      const products = await this.prisma.orderItem
        .findMany({
          distinct: ['productId'],
          where: {
            product: {
              void: false,
            },
            order: {
              void: false,
              status: OrderStatus.COMPLETE,
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          },
          select: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
        .then((data) => data.map((item) => item.product));

      for (const product of products) {
        const reportData: ReportProductRevenueDetailResponse[0]['reports'] = [];

        let totalNumberOfOrder = 0;
        let totalNumberOfItem = 0;
        let totalGoodValue = 0;
        let totalDiscount = 0;
        let totalNetRevenue = 0;
        let totalGrossProfit = 0;
        let totalAverageOrderValue = 0;
        let totalCost = 0;

        if (
          reportDate === DateFilterOptionValue.THIS_YEAR ||
          reportDate === DateFilterOptionValue.LAST_YEAR
        ) {
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const startOfMonth = new Date(currentDate);
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const endOfMonth = new Date(currentDate);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setDate(0);
            endOfMonth.setHours(23, 59, 59, 999);

            // Thông kê các đơn hàng có chứa sản phẩm
            const {
              _count: { id: NumberOfOrder },
            } = await this.prisma.order.aggregate({
              where: {
                void: false,
                status: OrderStatus.COMPLETE,
                createdAt: {
                  gte: startOfMonth,
                  lte: endOfMonth,
                },
                items: {
                  some: {
                    productId: product.id,
                  },
                },
              },
              _count: {
                id: true,
              },
            });

            // Tính tổng tiền hàng, giảm giá, doanh thu thuần của sản phẩm
            const {
              _sum: {
                totalPriceBeforeDiscount: GoodValue,
                totalPriceAfterDiscount: NetRevenue,
                totalDiscountAmount: Discount,
              },
            } = await this.prisma.orderItem.aggregate({
              where: {
                order: {
                  void: false,
                  status: OrderStatus.COMPLETE,
                  createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                  },
                },
                productId: product.id,
              },
              _sum: {
                totalPriceBeforeDiscount: true,
                totalPriceAfterDiscount: true,
                totalDiscountAmount: true,
              },
              _avg: {
                totalPriceAfterDiscount: true,
              },
            });

            // Các vật phẩm trong giỏ hàng thuộc sản phẩm
            const orderItems = await this.prisma.orderItem.findMany({
              where: {
                order: {
                  ...whereInput,
                  createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                  },
                },
                productId: product.id,
              },
              select: {
                quantity: true,
                sources: {
                  select: {
                    costPrice: true,
                    quantity: true,
                  },
                },
              },
            });

            // Tổng số lượng sản phẩm
            let NumberOfItem = 0;

            // Tổng giá vốn
            const totalCostPrice = orderItems.reduce((total, item) => {
              NumberOfItem += item.quantity;
              let cost = 0;
              for (const source of item.sources) {
                cost += source.quantity * source.costPrice;
              }
              return total + cost;
            }, 0);

            totalNumberOfOrder += NumberOfOrder;
            totalNumberOfItem += NumberOfItem;
            totalGoodValue += GoodValue;
            totalDiscount += Discount;
            totalNetRevenue += NetRevenue;
            totalGrossProfit += NetRevenue - totalCostPrice;
            totalAverageOrderValue += NetRevenue / NumberOfOrder;
            totalCost += totalCostPrice;

            const [d, m, y] = Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'short',
            })
              .format(currentDate)
              .split('/');

            reportData.push({
              time: `T${m}/20${y}`,
              averageOrderValue:
                NetRevenue / NumberOfOrder ? NetRevenue / NumberOfOrder : 0,
              cost: totalCostPrice,
              discount: Discount ?? 0,
              goodValue: GoodValue ?? 0,
              grossProfit: NetRevenue - totalCostPrice,
              netRevenue: NetRevenue ?? 0,
              numberOfOrder: NumberOfOrder,
              numberOfItem: NumberOfItem,
            });

            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        } else {
          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const startOfDay = new Date(currentDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(currentDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Thông kê các đơn hàng có chứa sản phẩm
            const {
              _count: { id: NumberOfOrder },
            } = await this.prisma.order.aggregate({
              where: {
                void: false,
                status: OrderStatus.COMPLETE,
                createdAt: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
                items: {
                  some: {
                    productId: product.id,
                  },
                },
              },
              _count: {
                id: true,
              },
            });

            // Tính tổng tiền hàng, giảm giá, doanh thu thuần của sản phẩm
            const {
              _sum: {
                totalPriceBeforeDiscount: GoodValue,
                totalPriceAfterDiscount: NetRevenue,
                totalDiscountAmount: Discount,
              },
            } = await this.prisma.orderItem.aggregate({
              where: {
                order: {
                  void: false,
                  status: OrderStatus.COMPLETE,
                  createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
                productId: product.id,
              },
              _sum: {
                totalPriceBeforeDiscount: true,
                totalPriceAfterDiscount: true,
                totalDiscountAmount: true,
              },
              _avg: {
                totalPriceAfterDiscount: true,
              },
            });

            // Các vật phẩm trong giỏ hàng thuộc sản phẩm
            const orderItems = await this.prisma.orderItem.findMany({
              where: {
                order: {
                  ...whereInput,
                  createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
                productId: product.id,
              },
              select: {
                quantity: true,
                sources: {
                  select: {
                    costPrice: true,
                    quantity: true,
                  },
                },
              },
            });

            // Tổng số lượng sản phẩm
            let NumberOfItem = 0;

            // Tổng giá vốn
            const totalCostPrice = orderItems.reduce((total, item) => {
              NumberOfItem += item.quantity;
              let cost = 0;
              for (const source of item.sources) {
                cost += source.quantity * source.costPrice;
              }
              return total + cost;
            }, 0);

            totalNumberOfOrder += NumberOfOrder;
            totalNumberOfItem += NumberOfItem;
            totalGoodValue += GoodValue;
            totalDiscount += Discount;
            totalNetRevenue += NetRevenue;
            totalGrossProfit += NetRevenue - totalCostPrice;
            totalAverageOrderValue += NetRevenue / NumberOfOrder;
            totalCost += totalCostPrice;

            const [d, m, y] = Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'short',
            })
              .format(currentDate)
              .split('/');

            reportData.push({
              time: `${d}/${m}/20${y}`,
              averageOrderValue:
                NetRevenue / NumberOfOrder ? NetRevenue / NumberOfOrder : 0,
              cost: totalCostPrice,
              discount: Discount ?? 0,
              goodValue: GoodValue ?? 0,
              grossProfit: NetRevenue - totalCostPrice,
              netRevenue: NetRevenue ?? 0,
              numberOfOrder: NumberOfOrder,
              numberOfItem: NumberOfItem,
            });

            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        response.push({
          product,
          reports: reportData,
          totalAverageOrderValue: totalAverageOrderValue,
          totalCost: totalCost,
          totalDiscount: totalDiscount,
          totalGoodValue: totalGoodValue,
          totalGrossProfit: totalGrossProfit,
          totalNetRevenue: totalNetRevenue,
          totalNumberOfItem: totalNumberOfItem,
          totalNumberOfOrder: totalNumberOfOrder,
        });
      }

      const sortResponse = response.sort(
        (a, b) => b.totalNetRevenue - a.totalNetRevenue,
      );

      return res.status(200).json(sortResponse);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
  }
}
