import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types/inventory.types';
import {
  OrderHistoryAction,
  OrderHistoryType,
  OrderStatus,
} from '../order.type';
import { CancelOrderDto } from '../order.dto';

@Injectable()
export class OrderCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderQueryService: OrderQueryService
  ) {}

  async cancelTemporaryOrder(orderId: string): Promise<void> {
    const order = await this.orderQueryService.getOrderDetail(orderId);
    if (!order)
      throw new Error('Không tìm thấy giao dịch hoặc giao dịch đã hủy');

    await this.prisma.$transaction(
      async (transaction) => {
        for (const item of order.items) {
          for (const source of item.sources) {
            const inventory = await transaction.inventory.findFirst({
              where: {
                variant_id: item.variant.id,
                warehouse_id: source.warehouseId,
              },
            });
            if (!inventory) continue;

            await transaction.inventory.update({
              where: { id: inventory.id },
              data: {
                avaiable: { increment: source.quantity },
                onTransaction: { decrement: source.quantity },
                histories: {
                  create: {
                    transactionAction:
                      InventoryTransactionAction.DELETE_TEMP_ORDER,
                    transactionType: InventoryTransactionType.ORDER,
                    avaiableQuantityChange: source.quantity,
                    onReceiveQuantityChange: source.quantity * -1,
                    newAvaiable: inventory.avaiable + source.quantity,
                    newOnTransaction: inventory.onTransaction - source.quantity,
                  },
                },
              },
            });

            if (source.receiveId) {
              await transaction.receiveItem.updateMany({
                where: {
                  receiveId: source.receiveId,
                  variantId: item.variantId,
                },
                data: {
                  quantityAvaiable: { increment: source.quantity },
                },
              });
            }
          }
        }

        for (const voucher of order.applyVouchers) {
          await transaction.discount.update({
            where: { id: voucher.discountId },
            data: { usage: { decrement: 1 } },
          });
        }

        await transaction.order.delete({ where: { id: orderId } });
      },
      { maxWait: 30000, timeout: 15000 }
    );
  }

  async cancelByAdmin(dto: CancelOrderDto, userId: number): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.update({
          where: { id: dto.orderId },
          data: {
            status: OrderStatus.CANCEL,
            history: {
              create: {
                action: OrderHistoryAction.CANCEL,
                type: OrderHistoryType.ADJUSTMENT,
                changedUserId: userId,
                reason: dto.reason.trim(),
              },
            },
          },
          select: {
            status: true,
            items: {
              select: {
                id: true,
                variantId: true,
                sources: {
                  select: {
                    receiveId: true,
                    warehouseId: true,
                    quantity: true,
                  },
                },
              },
            },
          },
        });

        for (const item of order.items) {
          for (const source of item.sources) {
            const inventory = await transaction.inventory.findFirst({
              where: {
                variant_id: item.variantId,
                warehouse_id: source.warehouseId,
              },
            });
            if (!inventory) continue;

            if (source.receiveId && dto.isReStock) {
              await transaction.receiveItem.updateMany({
                where: {
                  receiveId: source.receiveId,
                  variantId: item.variantId,
                },
                data: {
                  quantityAvaiable: { increment: source.quantity },
                },
              });
            }

            await transaction.inventory.update({
              where: { id: inventory.id },
              data: {
                avaiable: { increment: dto.isReStock ? source.quantity : 0 },
                onTransaction: { decrement: source.quantity },
                onHand: {
                  increment:
                    order.status === OrderStatus.IN_TRANSIT && dto.isReStock
                      ? source.quantity
                      : 0,
                },
                histories: {
                  create: {
                    transactionAction: InventoryTransactionAction.CANCEL_ORDER,
                    transactionType: InventoryTransactionType.ORDER,
                    newAvaiable: dto.isReStock
                      ? inventory.avaiable + source.quantity
                      : inventory.avaiable,
                    newOnTransaction: inventory.onTransaction - source.quantity,
                    newOnHand:
                      order.status === OrderStatus.IN_TRANSIT && dto.isReStock
                        ? inventory.onHand + source.quantity
                        : inventory.onHand,
                    avaiableQuantityChange: dto.isReStock ? source.quantity : 0,
                    OnTransactionQuantityChange: source.quantity * -1,
                    onHandQuantityChange:
                      order.status === OrderStatus.IN_TRANSIT
                        ? source.quantity
                        : 0,
                    changeUserId: userId,
                    orderId: dto.orderId,
                  },
                },
              },
            });
          }
        }
      },
      { maxWait: 20000, timeout: 20000 }
    );
  }

  async deleteOrder(orderId: string, userId: number): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        void: true,
        history: {
          create: {
            action: OrderHistoryAction.DELETE,
            type: OrderHistoryType.ADJUSTMENT,
            changedUserId: userId,
          },
        },
      },
    });
  }
}
