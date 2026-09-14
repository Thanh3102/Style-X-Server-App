import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationData } from 'src/utils/types';
import { QueryParams } from 'src/utils/types/query.types';
import { OrderStatus } from '../../order/order.type';
import { CustomerDetail, GetCustomerResponse } from '../customer.type';

export interface CustomerOrderHistoryQuery {
  status: string;
  page: string;
  limit: string;
}

const orderHistorySelect = {
  id: true,
  code: true,
  totalOrderBeforeDiscount: true,
  totalOrderAfterDiscount: true,
  totalOrderDiscountAmount: true,
  status: true,
  transactionStatus: true,
  createdAt: true,
  paymentMethod: true,
  items: {
    select: {
      id: true,
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
        },
      },
      quantity: true,
      totalPriceBeforeDiscount: true,
      totalPriceAfterDiscount: true,
      totalDiscountAmount: true,
      priceAfterDiscount: true,
      priceBeforeDiscount: true,
      discountAmount: true,
    },
  },
} satisfies Prisma.OrderSelect;

type CustomerOrderHistoryItem = Prisma.OrderGetPayload<{
  select: typeof orderHistorySelect;
}>;

export interface CustomerOrderHistoryResult {
  orders: CustomerOrderHistoryItem[];
  paginition: PaginationData;
}

@Injectable()
export class CustomerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomers(queryParams: QueryParams): Promise<GetCustomerResponse> {
    const { page: pg, limit: lim, query } = queryParams;
    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      status: OrderStatus.COMPLETE,
      void: false,
      customerId: {
        not: null,
      },
    };

    if (query) {
      where.customer = {
        OR: [
          { code: { startsWith: query.trim() } },
          { name: { startsWith: query.trim() } },
          { email: { startsWith: query.trim() } },
        ],
      };
    }

    const orderGroupBy = await this.prisma.order.groupBy({
      by: ['customerId'],
      where,
      _sum: {
        totalOrderAfterDiscount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalOrderAfterDiscount: 'desc',
        },
      },
      take: limit,
      skip,
    });

    const customerCount = await this.prisma.customer.count({});
    const customers: GetCustomerResponse['customers'] = [];

    for (const record of orderGroupBy) {
      const {
        _count: { id: numberOfOrder },
        _sum: { totalOrderAfterDiscount: totalOrderRevenue },
      } = record;
      const customer = await this.prisma.customer.findUnique({
        where: {
          id: record.customerId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      customers.push({
        ...customer,
        numberOfOrder,
        totalOrderRevenue,
      });
    }

    const total = Math.ceil(customerCount / limit);
    return {
      customers,
      paginition: {
        page,
        limit,
        total: total === 0 ? total + 1 : total,
        count: customerCount,
      },
    };
  }

  async getDetail(
    customerId: string,
    query: QueryParams
  ): Promise<CustomerDetail | null> {
    const sortOrder: Prisma.OrderOrderByWithRelationInput = {};

    if (query.sortBy) {
      switch (query.sortBy) {
        case 'latest':
          sortOrder.createdAt = 'desc';
          break;
        case 'ascending':
          sortOrder.totalItemAfterDiscount = 'asc';
          break;
        case 'descending':
          sortOrder.totalItemAfterDiscount = 'desc';
          break;
      }
    }

    return this.prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        gender: true,
        dob: true,
        email: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            code: true,
            totalItemAfterDiscount: true,
            province: true,
            district: true,
            ward: true,
            address: true,
            paymentMethod: true,
            status: true,
            transactionStatus: true,
            createdAt: true,
          },
          orderBy: sortOrder,
        },
      },
    });
  }

  async getOrderHistory(
    query: CustomerOrderHistoryQuery,
    customerId: string
  ): Promise<CustomerOrderHistoryResult> {
    const { status, page: pg, limit: lim } = query;
    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      customerId,
      void: false,
    };

    if (status) {
      where.status = status as OrderStatus;
    }

    const orders = await this.prisma.order.findMany({
      where,
      select: orderHistorySelect,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip,
    });

    const orderCount = await this.prisma.order.count({ where });
    const total = Math.ceil(orderCount / limit);

    return {
      orders,
      paginition: {
        page,
        limit,
        total: total === 0 ? total + 1 : total,
        count: orderCount,
      },
    };
  }
}
