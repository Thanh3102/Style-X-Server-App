import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const variantWarehouseSelect = {
  warehouse_id: true,
  warehouse: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.InventorySelect;

type VariantWarehouseRecord = Prisma.InventoryGetPayload<{
  select: typeof variantWarehouseSelect;
}>;

export type VariantWarehouse = {
  id: number;
  name: string;
};

@Injectable()
export class InventoryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getVariantWarehouses(variantId: number): Promise<VariantWarehouse[]> {
    const variantWarehouses: VariantWarehouseRecord[] =
      await this.prisma.inventory.findMany({
        where: {
          variant_id: variantId,
        },
        select: variantWarehouseSelect,
        distinct: ['warehouse_id'],
      });

    return variantWarehouses.map((item) => ({
      id: item.warehouse_id,
      name: item.warehouse.name,
    }));
  }
}
