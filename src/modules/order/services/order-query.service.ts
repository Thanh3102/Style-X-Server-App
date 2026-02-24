import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { tranformCreatedOnParams } from 'src/utils/helper/DateHelper';
import { QueryParams } from 'src/utils/types';
import { FormatOrder, OrderListResponseData } from '../order.type';
import { Response } from 'express';

@Injectable()
export class OrderQueryService {
  constructor(private prisma: PrismaService) {}

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        totalItemAfterDiscount: true,
        totalItemBeforeDiscount: true,
        totalItemDiscountAmount: true,
        totalOrderAfterDiscount: true,
        totalOrderBeforeDiscount: true,
        totalOrderDiscountAmount: true,
        expire: true,

        items: {
          include: {
            product: {
              select: {
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                title: true,
                image: true,
              },
            },
          },
        },
      },
    });
    return order;
  }

  async getOrderList(params: QueryParams) {
    const {
      page: pg,
      limit: lim,
      query,
      orderStatus,
      createdOn,
      createdOnMax,
      createdOnMin,
    } = params;
    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      void: false,
      code: {
        not: null,
      },
    };

    if (query) {
      where.OR = [
        {
          name: {
            startsWith: query.trim(),
          },
        },
        {
          phoneNumber: {
            startsWith: query.trim(),
          },
        },
        {
          code: {
            startsWith: query.trim(),
          },
        },
      ];
    }

    if (orderStatus) {
      where.status = orderStatus;
    }

    if (createdOn || createdOnMin || createdOnMax) {
      const { startDate, endDate } = tranformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax
      );
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput = {
      createdAt: 'desc',
    };

    const orders = await this.prisma.order.findMany({
      select: {
        id: true,
        code: true,
        userType: true,
        customerId: true,
        phoneNumber: true,
        name: true,
        totalOrderAfterDiscount: true,
        status: true,
        transactionStatus: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      where: where,
      orderBy: orderBy,
      take: limit,
      skip: skip,
    });

    const countOrders = await this.prisma.order.count({
      where: where,
    });

    const totalPage = Math.floor(
      countOrders / limit < 1 ? 1 : countOrders / limit
    );

    return {
      orders,
      paginition: {
        count: countOrders,
        page: page,
        limit: limit,
        total: totalPage,
      },
    };
  }

  async getOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                id: true,
                title: true,
                image: true,
              },
            },
            applyDiscounts: {
              include: {
                discount: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                  },
                },
              },
            },
            sources: {
              select: {
                id: true,
                costPrice: true,
                quantity: true,
                warehouseId: true,
                receiveId: true,
                receive: {
                  select: {
                    id: true,
                    code: true,
                  },
                },
                warehouse: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        applyDiscounts: {
          include: {
            discount: {
              select: {
                id: true,
                title: true,
                description: true,
              },
            },
          },
        },
        history: {
          select: {
            id: true,
            action: true,
            type: true,
            reason: true,
            createdAt: true,
            changedEmployee: {
              select: {
                id: true,
                name: true,
              },
            },
            changedCustomer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        applyVouchers: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return order;
  }

  async requestOrderList(params: QueryParams, res: Response) {
    try {
      const { orders, paginition } = await this.getOrderList(params);

      const formatOrderData: FormatOrder[] = orders.map((order) => {
        return {
          id: order.id,
          code: order.code,
          customer: order.customer,
          createdAt: order.createdAt,
          status: order.status,
          transactionStatus: order.transactionStatus,
          total: order.totalOrderAfterDiscount,
          customerId: order.customerId,
          phoneNumber: order.phoneNumber,
          name: order.name,
        };
      });

      const responseData: OrderListResponseData = {
        data: formatOrderData,
        paginition: paginition,
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: 'Đã xảy ra lỗi',
      });
    }
  }
}
