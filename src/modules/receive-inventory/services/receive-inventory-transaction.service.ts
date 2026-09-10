import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CancelReceiveInventoryDTO,
  ImportItemDTO,
  ProcessPaymentDTO,
  ReceiveHistoryAction,
  ReceiveHistoryType,
  ReceiveInventoryStatus,
  ReceiveInventoryTransaction,
} from '../receive-inventory.type';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';

@Injectable()
export class ReceiveInventoryTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async import(dto: ImportItemDTO, userId: number): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.receiveHistory.create({
          data: {
            type: ReceiveHistoryType.RECEIVE,
            action: ReceiveHistoryAction.RECEIVED,
            changedUserId: userId,
            receiveId: dto.receiveId,
          },
        });

        for (const item of dto.importItems) {
          await transaction.receiveItem.update({
            where: { id: item.itemId },
            data: {
              quantityReceived: { increment: item.importQuantity },
              quantityRemain: { decrement: item.importQuantity },
            },
          });

          const inventory = await transaction.inventory.findFirst({
            where: {
              variant_id: item.variantId,
              warehouse_id: dto.warehouseId,
            },
          });
          if (inventory) {
            await transaction.inventory.update({
              where: { id: inventory.id },
              data: {
                onHand: { increment: item.importQuantity },
                avaiable: { increment: item.importQuantity },
                onReceive: { decrement: item.importQuantity },
                histories: {
                  create: {
                    transactionAction: InventoryTransactionAction.RECEIPT,
                    transactionType: InventoryTransactionType.RECEIVE_INVENTORY,
                    onHandQuantityChange: item.importQuantity,
                    avaiableQuantityChange: item.importQuantity,
                    onReceiveQuantityChange: item.importQuantity * -1,
                    newOnHand: inventory.onHand + item.importQuantity,
                    newAvaiable: inventory.avaiable + item.importQuantity,
                    newOnReceive: inventory.onReceive - item.importQuantity,
                    changeUserId: userId,
                    receiveInventoryId: dto.receiveId,
                  },
                },
              },
            });
          }
        }

        const items = await transaction.receiveItem.findMany({
          where: { receiveId: dto.receiveId },
          select: { quantityRemain: true },
        });
        const isFullyReceived = items.every((item) => item.quantityRemain <= 0);
        await transaction.receiveInventory.update({
          where: { id: dto.receiveId },
          data: {
            status: isFullyReceived
              ? ReceiveInventoryStatus.RECEIVED
              : ReceiveInventoryStatus.PARTIALLY_RECEIVED,
          },
        });
      },
      { maxWait: 10000, timeout: 10000 }
    );
  }

  async processPayment(dto: ProcessPaymentDTO, userId: number): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const updatedReceive = await transaction.receiveInventory.update({
          where: { id: dto.receiveId },
          data: {
            transactionRemainAmount: { decrement: dto.transactionAmount },
            transactionStatus: ReceiveInventoryTransaction.PARTIALLY_PAID,
          },
        });

        if (updatedReceive.transactionRemainAmount === 0) {
          await transaction.receiveInventory.update({
            where: { id: dto.receiveId },
            data: { transactionStatus: ReceiveInventoryTransaction.PAID },
          });
        }

        await transaction.receiveTransaction.create({
          data: {
            amount: dto.transactionAmount,
            paymentMethod: dto.transactionMethod,
            processedAt: dto.transactionDate,
            receiveId: dto.receiveId,
            receiveHistory: {
              create: {
                action: ReceiveHistoryAction.PAID,
                type: ReceiveHistoryType.PAID,
                changedUserId: userId,
                receiveId: dto.receiveId,
              },
            },
          },
        });
      },
      { maxWait: 10000, timeout: 10000 }
    );
  }

  async cancel(dto: CancelReceiveInventoryDTO, userId: number): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const updatedReceive = await transaction.receiveInventory.update({
          where: { id: dto.receiveId },
          data: {
            status: ReceiveInventoryStatus.CANCEL,
            receiveHistories: {
              create: {
                action: ReceiveHistoryAction.CANCELLED,
                type: ReceiveHistoryType.RECEIVE,
                changedUserId: userId,
              },
            },
          },
        });

        const items = await transaction.receiveItem.findMany({
          where: { receiveId: dto.receiveId },
        });

        for (const item of items) {
          const inventory = await transaction.inventory.findFirst({
            where: {
              variant_id: item.variantId,
              warehouse_id: updatedReceive.warehouseId,
            },
          });
          if (!inventory || item.quantityRemain <= 0) continue;

          if (dto.returnItem) {
            await transaction.inventory.update({
              where: { id: inventory.id },
              data: {
                onHand: { decrement: item.quantityReceived },
                avaiable: { decrement: item.quantityReceived },
                onReceive: { decrement: item.quantityRemain },
                histories: {
                  create: {
                    transactionAction:
                      InventoryTransactionAction.RECEIVE_CANCEL,
                    transactionType: InventoryTransactionType.RECEIVE_INVENTORY,
                    newOnHand: inventory.onHand - item.quantityReceived,
                    newAvaiable: inventory.onHand - item.quantityReceived,
                    newOnReceive: inventory.onReceive - item.quantityRemain,
                    onHandQuantityChange: item.quantityReceived * -1,
                    avaiableQuantityChange: item.quantityReceived * -1,
                    onReceiveQuantityChange: item.quantityRemain * -1,
                    changeUserId: userId,
                    receiveInventoryId: dto.receiveId,
                  },
                },
              },
            });
          } else {
            await transaction.inventory.update({
              where: { id: inventory.id },
              data: {
                onReceive: { decrement: item.quantityRemain },
                histories: {
                  create: {
                    transactionAction:
                      InventoryTransactionAction.RECEIVE_CANCEL,
                    transactionType: InventoryTransactionType.RECEIVE_INVENTORY,
                    newOnReceive: inventory.onReceive - item.quantityRemain,
                    onReceiveQuantityChange: item.quantityRemain * -1,
                    changeUserId: userId,
                    receiveInventoryId: dto.receiveId,
                  },
                },
              },
            });
          }
        }
      },
      { maxWait: 10000, timeout: 10000 }
    );
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.receiveInventory.update({
        where: { id },
        data: {
          void: true,
          receiveHistories: {
            create: {
              action: ReceiveHistoryAction.DELETE,
              type: ReceiveHistoryType.RECEIVE,
              changedUserId: userId,
            },
          },
        },
      });
    });
  }
}
