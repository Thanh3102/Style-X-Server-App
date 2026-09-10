import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaginationData } from 'src/utils/types';
import { QueryParams } from 'src/utils/types/query.types';

const warehouseListSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  province: true,
  district: true,
  ward: true,
  email: true,
  phoneNumber: true,
  createdAt: true,
  active: true,
} satisfies Prisma.WarehouseSelect;

const warehouseIdentitySelect = {
  id: true,
  name: true,
} satisfies Prisma.WarehouseSelect;

const warehouseInventorySelect = {
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
} satisfies Prisma.InventorySelect;

export type WarehouseListItem = Prisma.WarehouseGetPayload<{
  select: typeof warehouseListSelect;
}>;

type WarehouseIdentity = Prisma.WarehouseGetPayload<{
  select: typeof warehouseIdentitySelect;
}>;

export type WarehouseInventoryItem = Prisma.InventoryGetPayload<{
  select: typeof warehouseInventorySelect;
}>;

export type WarehouseDetailResult = Partial<WarehouseIdentity> & {
  inventories: WarehouseInventoryItem[];
  paginition: PaginationData;
};

@Injectable()
export class WarehouseQueryService {
  private readonly logger = new Logger(WarehouseQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  getWarehouses(queryParams: QueryParams): Promise<WarehouseListItem[]> {
    const { active } = queryParams;
    const where: Prisma.WarehouseWhereInput = {};

    if (active) {
      where.active = active === 'true';
    }

    return this.prisma.warehouse.findMany({
      select: warehouseListSelect,
      where,
      orderBy: {
        active: 'desc',
      },
    });
  }

  async getWarehouseDetail(
    warehouseId: number,
    params: QueryParams
  ): Promise<WarehouseDetailResult> {
    const {
      page: pageParam,
      limit: limitParam,
      query,
      orderBy: orderByParam,
      direction,
    } = params;

    const page = !isNaN(Number(pageParam)) ? Number(pageParam) : 1;
    const limit = !isNaN(Number(limitParam)) ? Number(limitParam) : 20;
    const skip = page === 1 ? 0 : limit * (page - 1);

    const where: Prisma.InventoryWhereInput = {
      warehouse_id: warehouseId,
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

    if (orderByParam) {
      switch (orderByParam) {
        case 'product':
          this.logger.debug('Sorting warehouse inventories by product name');
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
          orderBy[orderByParam] = ['asc', 'desc'].includes(direction)
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

    const warehouse = await this.prisma.warehouse.findUnique({
      where: {
        id: warehouseId,
      },
      select: warehouseIdentitySelect,
    });

    const inventories = await this.prisma.inventory.findMany({
      where,
      orderBy,
      select: warehouseInventorySelect,
      take: limit,
      skip,
    });

    const count = await this.prisma.inventory.count({ where });
    const total = Math.ceil(count / limit);

    return {
      ...warehouse,
      inventories,
      paginition: {
        page,
        limit,
        total,
        count,
      },
    };
  }
}
