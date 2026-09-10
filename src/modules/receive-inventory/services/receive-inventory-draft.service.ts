import { Injectable } from '@nestjs/common';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';
import {
  CreateReceiveInventoryDTO,
  ReceiveHistoryAction,
  ReceiveHistoryType,
  ReceiveInventoryStatus,
  ReceiveInventoryTransaction,
  UpdateReceiveInventoryDTO,
} from '../receive-inventory.type';
import { TagType } from '../../tags/tag.type';
import { ReceiveInventoryValidationService } from './receive-inventory-validation.service';

export type ReceiveInventoryCreateResult = { id: number };

@Injectable()
export class ReceiveInventoryDraftService {
  private readonly tagType = TagType.RECEIVE;

  constructor(
    private readonly prisma: import('src/prisma/prisma.service').PrismaService,
    private readonly validationService: ReceiveInventoryValidationService
  ) {}

  async create(
    dto: CreateReceiveInventoryDTO,
    userId: number
  ): Promise<ReceiveInventoryCreateResult> {
    await this.validationService.assertCodeAvailable(dto.code);

    const createdReceive = await this.prisma.$transaction(
      async (transaction) => {
        const status = dto.importAfterCreate
          ? ReceiveInventoryStatus.RECEIVED
          : ReceiveInventoryStatus.NOT_RECEIVED;
        const code = dto.code
          ? dto.code.trim()
          : await generateCustomID('RE', 'receiveInventory');

        const receive = await transaction.receiveInventory.create({
          data: {
            importAfterCreate: dto.importAfterCreate,
            status,
            totalItems: dto.totalItems,
            totalItemsDiscount: dto.totalItemsDiscount,
            totalItemsPrice: dto.totalItemsPrice,
            totalLandedCost: dto.totalLandedCost,
            totalReceipt: dto.totalReceipt,
            totalItemsPriceBeforeDiscount: dto.totalItemsPriceBeforeDiscount,
            transactionRemainAmount: dto.totalReceipt,
            transactionStatus: ReceiveInventoryTransaction.UN_PAID,
            note: dto.note?.trim() ?? '',
            supplierId: dto.supplierId,
            warehouseId: dto.warehouseId,
            expectedAt: dto.expectedOn,
            createUserId: userId,
            code,
          },
        });

        await transaction.receiveItem.createMany({
          data: dto.items.map((item) => ({
            discountAmount: item.discountAmount,
            discountTotal: item.totalDiscount,
            discountType: item.discountType,
            discountValue: item.discountValue,
            price: item.price,
            total: item.total,
            finalPrice: item.finalPrice,
            finalTotal: item.finalTotal,
            quantity: item.quantity,
            quantityAvaiable: 0,
            quantityReceived: 0,
            quantityRemain: item.quantity,
            receiveId: receive.id,
            variantId: item.variantId,
          })),
        });

        await transaction.receiveLandedCost.createMany({
          data: dto.landedCosts.map((item) => ({
            ...item,
            receiveId: receive.id,
          })),
        });

        await transaction.receiveHistory.create({
          data: {
            type: ReceiveHistoryType.RECEIVE,
            action: ReceiveHistoryAction.CREATED,
            changedUserId: userId,
            receiveId: receive.id,
          },
        });

        await this.createInitialPaymentIfNeeded(
          transaction,
          dto,
          receive.id,
          userId
        );

        for (const item of dto.items) {
          await this.applyInventoryForCreatedReceive(
            transaction,
            dto,
            item,
            receive.id,
            userId
          );
        }

        await this.syncTags(transaction, dto.tags, receive.id);
        return receive;
      },
      { maxWait: 60000, timeout: 60000 }
    );

    return { id: createdReceive.id };
  }

  async update(dto: UpdateReceiveInventoryDTO, userId: number): Promise<void> {
    await this.validationService.assertCodeAvailable(dto.code, dto.receiveId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.receiveInventory.update({
        where: { id: dto.receiveId },
        data: {
          code: dto.code.trim(),
          expectedAt: dto.expectedOn,
          note: dto.note.trim(),
          receiveHistories: {
            create: {
              action: ReceiveHistoryAction.UPDATE,
              type: ReceiveHistoryType.RECEIVE,
              changedUserId: userId,
            },
          },
        },
      });

      const allReceiveTags = await transaction.tag.findMany({
        where: { type: this.tagType },
        select: { id: true, name: true },
      });

      for (const tag of dto.addTags) {
        const existingTag = allReceiveTags.find((item) => item.name === tag);
        if (existingTag) {
          await transaction.receiveInventoryTag.create({
            data: {
              receiveId: dto.receiveId,
              tagId: existingTag.id,
            },
          });
          await transaction.tag.update({
            data: { lastUsedAt: new Date() },
            where: { id: existingTag.id },
          });
        } else {
          await transaction.tag.create({
            data: { name: tag, type: this.tagType },
          });
        }
      }

      const deleteTags = allReceiveTags.filter((tag) =>
        dto.deleteTags.includes(tag.name)
      );
      await transaction.receiveInventoryTag.deleteMany({
        where: {
          receiveId: dto.receiveId,
          tagId: { in: deleteTags.map((tag) => tag.id) },
        },
      });
    });
  }

  private async createInitialPaymentIfNeeded(
    transaction: PrismaTransactionClient,
    dto: CreateReceiveInventoryDTO,
    receiveId: number,
    userId: number
  ): Promise<void> {
    if (dto.transactionStatus !== ReceiveInventoryTransaction.PAID) return;

    const remainAmount = dto.totalReceipt - dto.transactionAmount;
    await transaction.receiveInventory.update({
      where: { id: receiveId },
      data: {
        transactionRemainAmount: remainAmount,
        transactionStatus:
          remainAmount <= 0
            ? ReceiveInventoryTransaction.PAID
            : ReceiveInventoryTransaction.PARTIALLY_PAID,
      },
    });

    const receiveTransaction = await transaction.receiveTransaction.create({
      data: {
        amount: dto.transactionAmount,
        paymentMethod: dto.transactionMethod,
        processedAt: dto.transactionDate,
        receiveId,
      },
    });
    await transaction.receiveHistory.create({
      data: {
        type: ReceiveHistoryType.PAID,
        action: ReceiveHistoryAction.PAID,
        changedUserId: userId,
        transactionId: receiveTransaction.id,
        receiveId,
      },
    });
  }

  private async applyInventoryForCreatedReceive(
    transaction: PrismaTransactionClient,
    dto: CreateReceiveInventoryDTO,
    item: CreateReceiveInventoryDTO['items'][number],
    receiveId: number,
    userId: number
  ): Promise<void> {
    const inventory = await transaction.inventory.findFirst({
      where: {
        warehouse_id: dto.warehouseId,
        variant_id: item.variantId,
      },
    });

    if (dto.importAfterCreate) {
      await transaction.receiveItem.updateMany({
        where: { receiveId, variantId: item.variantId },
        data: {
          quantityAvaiable: item.quantity,
          quantityReceived: item.quantity,
          quantityRemain: 0,
        },
      });

      if (inventory) {
        const newOnHand = inventory.onHand + item.quantity;
        const newAvaiable = inventory.avaiable + item.quantity;
        await transaction.inventory.update({
          where: { id: inventory.id },
          data: {
            onHand: newOnHand,
            avaiable: newAvaiable,
            histories: {
              create: {
                transactionAction: InventoryTransactionAction.RECEIPT,
                transactionType: InventoryTransactionType.RECEIVE_INVENTORY,
                avaiableQuantityChange: item.quantity,
                onHandQuantityChange: item.quantity,
                newAvaiable,
                newOnHand,
                changeUserId: userId,
                receiveInventoryId: receiveId,
              },
            },
          },
        });
        return;
      }

      const createdInventory = await this.createEmptyInventory(
        transaction,
        dto.warehouseId,
        item.variantId,
        receiveId,
        userId
      );
      const newOnHand = createdInventory.onHand + item.quantity;
      const newAvaiable = createdInventory.avaiable + item.quantity;
      await transaction.inventory.update({
        where: { id: createdInventory.id },
        data: {
          onHand: newOnHand,
          avaiable: newAvaiable,
          histories: {
            create: {
              transactionAction: InventoryTransactionAction.RECEIPT,
              transactionType: InventoryTransactionType.RECEIVE_INVENTORY,
              avaiableQuantityChange: item.quantity,
              onHandQuantityChange: item.quantity,
              newAvaiable,
              newOnHand,
              changeUserId: userId,
              receiveInventoryId: receiveId,
            },
          },
        },
      });
      return;
    }

    if (inventory) {
      const newOnReceive = inventory.onReceive + item.quantity;
      await transaction.inventory.update({
        where: { id: inventory.id },
        data: {
          onReceive: newOnReceive,
          histories: {
            create: {
              transactionAction: InventoryTransactionAction.PURCHASE,
              transactionType: InventoryTransactionType.PURCHASE_ORDER,
              onReceiveQuantityChange: item.quantity,
              newOnReceive,
              changeUserId: userId,
              receiveInventoryId: receiveId,
            },
          },
        },
      });
      return;
    }

    const createdInventory = await this.createEmptyInventory(
      transaction,
      dto.warehouseId,
      item.variantId,
      receiveId,
      userId
    );
    const newOnReceive = createdInventory.onReceive + item.quantity;
    await transaction.inventory.update({
      where: { id: createdInventory.id },
      data: {
        onReceive: newOnReceive,
        histories: {
          create: {
            transactionAction: InventoryTransactionAction.PURCHASE,
            transactionType: InventoryTransactionType.PURCHASE_ORDER,
            onReceiveQuantityChange: item.quantity,
            newOnReceive,
            changeUserId: userId,
            receiveInventoryId: receiveId,
          },
        },
      },
    });
  }

  private createEmptyInventory(
    transaction: PrismaTransactionClient,
    warehouseId: number,
    variantId: number,
    receiveId: number,
    userId: number
  ) {
    return transaction.inventory.create({
      data: {
        variant_id: variantId,
        avaiable: 0,
        onHand: 0,
        onTransaction: 0,
        onReceive: 0,
        warehouse_id: warehouseId,
        histories: {
          create: {
            transactionAction: InventoryTransactionAction.INITIAL_SETUP,
            transactionType: InventoryTransactionType.RECEIVE_INVENTORY,
            changeUserId: userId,
            newAvaiable: 0,
            newOnHand: 0,
            newOnReceive: 0,
            newOnTransaction: 0,
            receiveInventoryId: receiveId,
          },
        },
      },
    });
  }

  private async syncTags(
    transaction: PrismaTransactionClient,
    tags: string[],
    receiveId: number
  ): Promise<void> {
    const allReceiveTags = await transaction.tag.findMany({
      select: { id: true, name: true },
      where: { type: this.tagType },
    });

    for (const tag of tags) {
      const existingTag = allReceiveTags.find((item) => item.name === tag);
      if (existingTag) {
        await transaction.receiveInventoryTag.create({
          data: { receiveId, tagId: existingTag.id },
        });
      } else {
        await transaction.tag.create({
          data: {
            name: tag,
            type: this.tagType,
            receiveTags: { create: { receiveId } },
          },
        });
      }
    }

    await transaction.tag.updateMany({
      data: { lastUsedAt: new Date() },
      where: { name: { in: tags }, type: this.tagType },
    });
  }
}
