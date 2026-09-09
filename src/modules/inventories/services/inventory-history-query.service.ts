import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { isInteger } from 'src/utils/helper/StringHelper';
import { PaginationData, QueryParams } from 'src/utils/types';

const inventoryHistoryInclude = {
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
} satisfies Prisma.InventoryHistoryInclude;

export type InventoryHistoryItem = Prisma.InventoryHistoryGetPayload<{
  include: typeof inventoryHistoryInclude;
}>;

export type InventoryHistoryResult = {
  inventoryHistory: InventoryHistoryItem[];
  paginition: PaginationData;
};

@Injectable()
export class InventoryHistoryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHistory(queryParams: QueryParams): Promise<InventoryHistoryResult> {
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
      const ids = this.parseIds(variantIds);
      whereCondition.inventory = {
        variant_id: {
          in: [...ids],
        },
      };
    }

    if (receiveIds) {
      const ids = this.parseIds(receiveIds);
      whereCondition.receiveInventoryId = {
        in: [...ids],
      };
    }

    if (warehouseIds) {
      const ids = this.parseIds(warehouseIds);

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
      include: inventoryHistoryInclude,
      orderBy: {
        changeOn: 'desc',
      },
      skip,
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
        page,
        limit,
      },
    };
  }

  private parseIds(value: string): number[] {
    return value.split(',').map((id) => {
      if (isInteger(id)) return parseInt(id);
      return 0;
    });
  }
}
