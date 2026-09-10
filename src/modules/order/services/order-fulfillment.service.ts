import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/modules/mail/mail.service';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types/inventory.types';
import {
  OrderHistoryAction,
  OrderHistoryType,
  OrderStatus,
  OrderTransactionStatus,
} from '../order.type';

@Injectable()
export class OrderFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  async confirmDelivery(
    orderId: string,
    isSendEmail: boolean,
    userId: number
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id: orderId },
        select: { transactionStatus: true },
      });

      const order = await transaction.order.update({
        where: { id: orderId },
        data: {
          status:
            currentOrder.transactionStatus === OrderTransactionStatus.PAID
              ? OrderStatus.COMPLETE
              : OrderStatus.IN_TRANSIT,
          history: {
            create: {
              action: OrderHistoryAction.CONFIRM_SHIPPING,
              type: OrderHistoryType.ADJUSTMENT,
              changedUserId: userId,
            },
          },
        },
        select: {
          code: true,
          name: true,
          email: true,
          province: true,
          district: true,
          ward: true,
          address: true,
          items: {
            select: {
              product: { select: { name: true } },
              priceAfterDiscount: true,
              quantity: true,
              totalPriceAfterDiscount: true,
              sources: true,
              variantId: true,
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

          await transaction.inventory.update({
            where: { id: inventory.id },
            data: {
              onHand: { decrement: source.quantity },
              histories: {
                create: {
                  transactionAction: InventoryTransactionAction.DELIVERY,
                  transactionType: InventoryTransactionType.ORDER,
                  onHandQuantityChange: source.quantity * -1,
                  newOnHand: inventory.onHand * source.quantity,
                  changeUserId: userId,
                  orderId,
                },
              },
            },
          });
        }
      }

      if (isSendEmail) {
        await this.mailService.sendUserDeliveryConfirmNotification(order);
      }
    });
  }

  async confirmPaymentReceived(orderId: string, userId: number): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.COMPLETE,
            transactionStatus: OrderTransactionStatus.PAID,
            history: {
              create: {
                action: OrderHistoryAction.CONFIRM_PAYMENT,
                type: OrderHistoryType.ADJUSTMENT,
                changedUserId: userId,
              },
            },
          },
          select: {
            id: true,
            items: { select: { sources: true, variantId: true } },
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

            await transaction.inventory.update({
              where: { id: inventory.id },
              data: {
                onTransaction: { decrement: source.quantity },
                histories: {
                  create: {
                    transactionAction:
                      InventoryTransactionAction.DELIVERY_COMPLETE,
                    transactionType: InventoryTransactionType.ORDER,
                    OnTransactionQuantityChange: source.quantity * -1,
                    newOnTransaction: inventory.onTransaction * source.quantity,
                    changeUserId: userId,
                    orderId: order.id,
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
}
