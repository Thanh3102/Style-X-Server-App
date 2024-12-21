import { BadRequestException, Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';
import {
  ChangePasswordDto,
  CustomerDetail,
  GetCustomerResponse,
  UpdateInfoDto,
} from './customer.type';
import { OrderStatus } from '../order/order.type';
import { Prisma } from '@prisma/client';
import { comparePassword, hashPlainText } from 'src/utils/helper/bcryptHelper';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async get(queryParams: QueryParams, res: Response) {
    try {
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
            {
              code: {
                startsWith: query,
              },
            },
            {
              name: {
                startsWith: query,
              },
            },
            {
              email: {
                startsWith: query,
              },
            },
          ],
        };
      }

      const orderGroupBy = await this.prisma.order.groupBy({
        by: ['customerId'],
        where: where,
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
        skip: skip,
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
          numberOfOrder: numberOfOrder,
          totalOrderRevenue: totalOrderRevenue,
        });
      }
      const total = Math.ceil(customerCount / limit);
      const responseData: GetCustomerResponse = {
        customers,
        paginition: {
          page: page,
          limit: limit,
          total: total === 0 ? total + 1 : total,
          count: customerCount,
        },
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getDetail(customerId: string, query: QueryParams, res: Response) {
    const { sortBy } = query;
    let sortOrder: Prisma.OrderOrderByWithRelationInput = {};

    if (sortBy) {
      switch (sortBy) {
        case 'latest':
          sortOrder.createdAt = 'desc';
          break;
        case 'ascending':
          sortOrder.totalItemAfterDiscount = 'asc';
          break;
        case 'ascending':
          sortOrder.totalItemAfterDiscount = 'desc';
          break;
      }
    }

    try {
      const customer = await this.prisma.customer.findUnique({
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

      const responseData: CustomerDetail = customer;

      return res.status(200).json(responseData);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getInfo(req, res: Response) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          id: req.user.id,
        },
        select: {
          id: true,
          name: true,
          dob: true,
          email: true,
          gender: true,
        },
      });

      return res.status(200).json(customer);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async updateInfo(dto: UpdateInfoDto, req, res: Response) {
    try {
      await this.prisma.customer.update({
        where: {
          id: req.user.id,
        },
        data: {
          name: dto.name,
          gender: dto.gender,
        },
      });
      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async changePassword(dto: ChangePasswordDto, req, res: Response) {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: {
          id: req.user.id,
        },
        select: {
          password: true,
        },
      });

      if (!customer) {
        throw new BadRequestException('Không tìm thấy thông tin khách hàng');
      }

      const isCorrectPW = await comparePassword(
        dto.oldPassword,
        customer.password,
      );

      if (!isCorrectPW) {
        throw new BadRequestException('Mật khẩu cũ không chính xác');
      }

      const hashPW = await hashPlainText(dto.newPassword);

      await this.prisma.customer.update({
        where: {
          id: req.user.id,
        },
        data: {
          password: hashPW,
        },
      });

      return res.status(200).json({ message: 'Đã cập nhật mật khẩu' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getOrderHistory(
    query: { status: string; page: string; limit: string },
    req,
    res: Response,
  ) {
    const { status, page: pg, limit: lim } = query;
    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;
    try {
      const whereConditon: Prisma.OrderWhereInput = {
        customerId: req.user.id,
        void: false,
      };

      if (status) {
        whereConditon.status = status as OrderStatus;
      }

      const orders = await this.prisma.order.findMany({
        where: whereConditon,
        select: {
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
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: skip,
      });

      const countOrder = await this.prisma.order.count({
        where: whereConditon,
      });

      const total = Math.ceil(countOrder / limit);
      return res.status(200).json({
        orders: orders,
        paginition: {
          page: page,
          limit: limit,
          total: total === 0 ? total + 1 : total,
          count: countOrder,
        },
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }
}