import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouses.type';
import { Response } from 'express';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { Prisma } from '@prisma/client';
import { ReceiveInventoryStatus } from '../receive-inventory/receive-inventory.type';
import { OrderStatus } from '../order/order.type';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  async get(queryParams: QueryParams) {
    const { active } = queryParams;
    const where: Prisma.WarehouseWhereInput = {};
    if (active) {
      where.active = active === 'true';
    }
    const warehouses = await this.prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        // country: true,
        province: true,
        district: true,
        ward: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
        active: true,
      },
      where: where,
      orderBy: {
        active: 'desc',
      },
    });

    return warehouses;
  }

  async create(dto: CreateWarehouseDto, req, res: Response) {
    try {
      const existName = await this.prisma.warehouse.findFirst({
        where: {
          name: dto.name,
        },
      });
      if (existName) throw new BadRequestException('Tên kho hàng đã sử dụng');

      const code = await generateCustomID('WH', 'warehouse');

      await this.prisma.warehouse.create({
        data: {
          code: code,
          name: dto.name,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          address: dto.address,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          createdUserId: req.user.id,
        },
      });

      return res.status(200).json({ message: 'Tạo kho hàng thành công' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async update(dto: UpdateWarehouseDto, req, res: Response) {
    try {
      const existName = await this.prisma.warehouse.findFirst({
        where: {
          name: dto.name,
          id: {
            not: dto.id,
          },
        },
      });
      if (existName) throw new BadRequestException('Tên kho hàng đã sử dụng');

      if (dto.active === false) {
        const receives = await this.prisma.receiveInventory.findFirst({
          where: {
            warehouseId: dto.id,
            status: {
              in: [
                ReceiveInventoryStatus.NOT_RECEIVED,
                ReceiveInventoryStatus.PARTIALLY_RECEIVED,
              ],
            },
          },
          select: {
            id: true,
          },
        });
        const orderSources = await this.prisma.order.findFirst({
          where: {
            status: {
              not: {
                in: [OrderStatus.COMPLETE, OrderStatus.CANCEL],
              },
            },
            items: {
              some: {
                sources: {
                  some: {
                    warehouseId: dto.id,
                  },
                },
              },
            },
          },
        });

        console.log(receives, orderSources);

        if (receives || orderSources) {
          throw new BadRequestException(
            'Không thể cập nhật trạng thái khi kho hàng vẫn còn giao dịch chưa hoàn thành',
          );
        }
      }

      await this.prisma.warehouse.update({
        where: {
          id: dto.id,
        },
        data: {
          name: dto.name,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          address: dto.address,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          active: dto.active,
          updatedUserId: req.user.id,
        },
      });

      return res.status(200).json({ message: 'Cập nhật thành công' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getDetail(warehouse_id: number, params: QueryParams, res: Response) {
    const {
      page: pg,
      limit: lim,
      query,
      orderBy: OrderByParam,
      direction,
    } = params;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : limit * (page - 1);

    const where: Prisma.InventoryWhereInput = {
      warehouse_id: warehouse_id,
    };

    const orderBy: Prisma.InventoryOrderByWithRelationInput = {};

    if (query) {
      where.productVariant = {
        product: {
          name: {
            contains: query,
          },
        },
      };
    }

    if (OrderByParam) {
      switch (OrderByParam) {
        case 'product':
          console.log('here');

          orderBy.productVariant = {
            product: {
              name: ['asc', 'desc'].includes(direction)
                ? (direction as 'asc' | 'desc')
                : 'asc',
            },
          };
          break;
        case 'avaiable':
        case 'onHand':
        case 'onTransaction':
        case 'onReceive':
          orderBy[OrderByParam] = ['asc', 'desc'].includes(direction)
            ? (direction as 'asc' | 'desc')
            : 'asc';
          break;
        default:
          orderBy.productVariant = {
            product: {
              name: 'asc',
            },
          };
      }
    }

    try {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: {
          id: warehouse_id,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const inventories = await this.prisma.inventory.findMany({
        where: where,
        orderBy: orderBy,
        select: {
          id: true,
          avaiable: true,
          onHand: true,
          onReceive: true,
          onTransaction: true,
          productVariant: {
            select: {
              id: true,
              title: true,
              skuCode: true,
              barCode: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
        take: limit,
        skip: skip,
      });

      const count = await this.prisma.inventory.count({
        where: where,
      });

      const total = await Math.ceil(count / limit);

      return res.status(200).json({
        ...warehouse,
        inventories: inventories,
        paginition: {
          page: page,
          limit: limit,
          total: total,
          count: count,
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
