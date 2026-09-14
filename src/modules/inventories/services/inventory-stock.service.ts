import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types/inventory.types';
import { ChangeOnHandDTO, CreateInventoryDTO } from '../inventories.type';

@Injectable()
export class InventoryStockService {
  constructor(private readonly prisma: PrismaService) {}

  async createInventories(
    dto: CreateInventoryDTO,
    requestUserId: number
  ): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      for (const warehouse of dto.warehouses) {
        await prisma.inventory.create({
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
  }

  async changeOnHand(
    dto: ChangeOnHandDTO,
    requestUserId: number
  ): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      const inventory = await prisma.inventory.findUnique({
        where: {
          id: dto.inventoryId,
        },
      });
      const newAvaiable = dto.onHand - inventory.onTransaction;
      const avaiableChange = newAvaiable - inventory.avaiable;

      if (newAvaiable < 0) {
        throw new BadRequestException('Giá trị tồn kho không hợp lý');
      }

      const updateInventory = await prisma.inventory.update({
        where: {
          id: dto.inventoryId,
        },
        data: {
          onHand: dto.onHand,
          avaiable: newAvaiable,
        },
      });

      await prisma.inventoryHistory.create({
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
  }
}
