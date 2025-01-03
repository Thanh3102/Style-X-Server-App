import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ChangeOnHandDTO, CreateInventoryDTO } from './inventories.type';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
  QueryParams,
} from 'src/utils/types';
import { Response } from 'express';
import { isInteger } from 'src/utils/helper/StringHelper';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInventoryDTO, req, res: Response) {
    const requestUserId = req.user.id;
    try {
      await this.prisma.$transaction(async (p) => {
        for (const warehouse of dto.warehouses) {
          await p.inventory.create({
            data: {
              variant_id: dto.variantId,
              warehouse_id: warehouse.id,
              onHand: warehouse.onHand,
              avaiable: warehouse.onHand,
              histories: {
                create: {
                  avaiableQuantityChange: warehouse.onHand,
                  onHandQuantityChange: warehouse.onHand,
                  newAvaiable: warehouse.onHand,
                  newOnHand: warehouse.onHand,
                  transactionType: InventoryTransactionType.PRODUCT,
                  transactionAction: InventoryTransactionAction.INITIAL_SETUP,
                  changeUserId: requestUserId,
                },
              },
            },
          });
        }
      });

      return res.json({ message: 'Thêm kho lưu trữ thành công.' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message ?? 'Đã xảy ra lỗi');
    }
  }

  async changeOnHand(dto: ChangeOnHandDTO, req, res: Response) {
    const requestUserId = req.user.id;
    try {
      await this.prisma.$transaction(async (p) => {
        const inventory = await p.inventory.findUnique({
          where: {
            id: dto.inventoryId,
          },
        });
        const newAvaiable = dto.onHand - inventory.onTransaction;
        const avaiableChange = newAvaiable - inventory.avaiable;
        if (newAvaiable < 0) {
          throw new BadRequestException('Giá trị tồn kho không hợp lý');
        }

        const updateInventory = await p.inventory.update({
          where: {
            id: dto.inventoryId,
          },
          data: {
            onHand: dto.onHand,
            avaiable: newAvaiable,
          },
        });

        await p.inventoryHistory.create({
          data: {
            transactionAction: InventoryTransactionAction.ADJUST,
            transactionType: InventoryTransactionType.PRODUCT,
            reason: dto.reason,
            avaiableQuantityChange: avaiableChange,
            onHandQuantityChange: dto.changeValue,
            newAvaiable: updateInventory.avaiable,
            newOnHand: updateInventory.onHand,
            changeUserId: requestUserId,
            inventoryId: dto.inventoryId,
          },
        });
      });

      return res.json({ message: 'Cập nhật tồn kho thành công' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message ?? 'Đã xảy ra lỗi');
    }
  }

  async getHistory(queryParams: QueryParams) {
    const {
      page: pg,
      limit: lim,
      receiveIds,
      variantIds,
      warehouseIds,
      type,
    } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 50;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const whereCondition: Prisma.InventoryHistoryWhereInput = {};

    if (variantIds) {
      const ids = variantIds.split(',').map((id) => {
        if (isInteger(id)) return parseInt(id);
        return 0;
      });

      whereCondition.inventory = {
        variant_id: {
          in: [...ids],
        },
      };
    }

    if (receiveIds) {
      const ids = receiveIds.split(',').map((id) => {
        if (isInteger(id)) return parseInt(id);
        return 0;
      });
      whereCondition.receiveInventoryId = {
        in: [...ids],
      };
    }

    if (warehouseIds) {
      const ids = warehouseIds.split(',').map((id) => {
        if (isInteger(id)) return parseInt(id);
        return 0;
      });

      if (whereCondition.inventory) {
        whereCondition.inventory.warehouse_id = {
          in: [...ids],
        };
      } else {
        whereCondition.inventory = {
          warehouse_id: {
            in: [...ids],
          },
        };
      }
    }

    if (type) {
      whereCondition.transactionType = type;
    }

    const inventories = await this.prisma.inventoryHistory.findMany({
      where: whereCondition,
      include: {
        changeUser: {
          select: {
            name: true,
          },
        },
        inventory: {
          select: {
            warehouse: {
              select: {
                name: true,
              },
            },
            productVariant: {
              select: {
                id: true,
                title: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        receiveInventory: {
          select: {
            id: true,
            code: true,
          },
        },
        order: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      orderBy: {
        changeOn: 'desc',
      },
      skip: skip,
      take: limit,
    });

    const countInventoriesHistory = await this.prisma.inventoryHistory.count({
      where: whereCondition,
    });

    const totalPage = Math.floor(countInventoriesHistory / limit);

    return {
      inventoryHistory: inventories,
      paginition: {
        total: countInventoriesHistory % limit == 0 ? totalPage : totalPage + 1,
        count: countInventoriesHistory,
        page: page,
        limit: limit,
      },
    };
  }

  async getVariantWarehouses(variantId: number) {
    try {
      const variantWarehouses = await this.prisma.inventory.findMany({
        where: {
          variant_id: variantId,
        },
        select: {
          warehouse_id: true,
          warehouse: {
            select: {
              name: true,
            },
          },
        },
        distinct: ['warehouse_id'],
      });

      const warehouses = variantWarehouses.map((item) => {
        return {
          id: item.warehouse_id,
          name: item.warehouse.name,
        };
      });

      return warehouses;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
