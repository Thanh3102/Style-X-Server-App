import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CartCheckoutService } from 'src/modules/cart/services/cart-checkout.service';
import { DiscountService } from 'src/modules/discount/discount.service';
import { ActiveDiscount } from 'src/modules/discount/discount.type';
import { CreateTempOrderDto } from '../order.dto';
import {
  OrderHistoryAction,
  OrderHistoryType,
  OrderStatus,
  OrderTransactionStatus,
  TemporaryOrderResult,
} from '../order.type';
import { OrderCalculationService } from './order-calculation.service';
import { OrderInventoryService } from './order-inventory.service';

@Injectable()
export class OrderTemporaryCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderCalculationService: OrderCalculationService,
    private readonly orderInventoryService: OrderInventoryService,
    private readonly cartCheckoutService: CartCheckoutService,
    private readonly discountService: DiscountService
  ) {}

  async create(
    dto: CreateTempOrderDto,
    actorId?: string | number
  ): Promise<TemporaryOrderResult> {
    return this.prisma.$transaction(
      async (p): Promise<TemporaryOrderResult> => {
        const items = await this.cartCheckoutService.getCartItemsData(
          p,
          dto.type,
          dto.cartItemIds
        );
        let totalItemBeforeDiscount = 0;
        let totalItemAfterDiscount = 0;
        let totalItemDiscountAmount = 0;

        for (const item of items) {
          totalItemBeforeDiscount += item.variant.sellPrice * item.quantity;
          const avaiable = item.variant.inventories.reduce(
            (total, inv) => total + inv.avaiable,
            0
          );

          if (avaiable < item.quantity) {
            return {
              status: 400,
              body: {
                message: `Sản phẩm ${item.product.name} ${item.variant.title !== 'Default Title' ? `(${item.variant.title})` : ''} không còn đủ số lượng hoặc đã hết hàng. Vui lòng giảm số lượng`,
              },
            };
          }
        }

        const itemAfterCalculatePromises = items.map(async (item) => {
          const { applyPromotions, discountAmount, priceAfterDiscount } =
            await this.orderCalculationService.calculateItem(
              item,
              totalItemBeforeDiscount
            );
          totalItemAfterDiscount += priceAfterDiscount * item.quantity;
          totalItemDiscountAmount += discountAmount * item.quantity;

          const itemsFrom = await this.orderInventoryService.findItemReceive(
            item,
            p
          );

          return {
            ...item,
            quantity: item.quantity,
            priceBeforeDiscount: item.variant.sellPrice,
            priceAfterDiscount,
            discountAmount,
            applyPromotions,
            itemsFrom,
          };
        });

        const itemsAfterCalculate = await Promise.all(
          itemAfterCalculatePromises
        );

        const totalOrderBeforeDiscount = totalItemAfterDiscount;
        let totalOrderRemain = totalItemAfterDiscount;

        const activeOrderPromotions =
          await this.discountService.getActiveDiscounts({
            mode: ['promotion'],
            type: ['order'],
          });

        const affectedOrderPromotions = activeOrderPromotions.filter(
          (promotion) => {
            switch (promotion.prerequisite) {
              case 'none':
                return true;
              case 'prerequisiteMinTotal':
                if (promotion.combinesWithProductDiscount)
                  return (
                    totalItemAfterDiscount >= promotion.prerequisiteMinTotal
                  );

                if (!promotion.combinesWithProductDiscount)
                  return (
                    totalItemAfterDiscount >= promotion.prerequisiteMinTotal
                  );
                break;

              case 'prerequisiteMinItem':
                if (items.length >= promotion.prerequisiteMinItem) return true;
                break;
            }
            return false;
          }
        );

        const canCombineOrderPromotion = affectedOrderPromotions.filter(
          (promo) => promo.combinesWithOrderDiscount
        );

        const canCombineValueDiscount = canCombineOrderPromotion.filter(
          (promo) => promo.valueType === 'value'
        );

        const canCombinePercentDiscount = canCombineOrderPromotion.filter(
          (promo) => promo.valueType === 'percent'
        );

        const cannotCombineOrderPromotion = affectedOrderPromotions.filter(
          (promo) => !promo.combinesWithOrderDiscount
        );

        let totalOrderDiscountAmount = 0;
        const applyOrderPromotions: Array<ActiveDiscount & { amount: number }> =
          [];

        if (cannotCombineOrderPromotion.length > 0) {
          let maxNonCombineDiscountAmount = -1;
          let discountValue = 0;
          let applyPromotion = null;
          for (const promotion of cannotCombineOrderPromotion) {
            switch (promotion.valueType) {
              case 'percent':
                let percentDiscountValue = Math.round(
                  totalItemAfterDiscount * promotion.value * 0.01
                );
                if (promotion.valueLimitAmount) {
                  percentDiscountValue =
                    percentDiscountValue <= promotion.valueLimitAmount
                      ? percentDiscountValue
                      : promotion.valueLimitAmount;
                }
                if (percentDiscountValue > maxNonCombineDiscountAmount) {
                  maxNonCombineDiscountAmount = percentDiscountValue;
                  applyPromotion = promotion;
                  discountValue = percentDiscountValue;
                }
                break;
              case 'value':
                const valueDiscountValue =
                  totalItemAfterDiscount - promotion.value >= 0
                    ? totalItemAfterDiscount - promotion.value
                    : 0;
                if (valueDiscountValue > maxNonCombineDiscountAmount) {
                  maxNonCombineDiscountAmount = valueDiscountValue;
                  applyPromotion = promotion;
                  discountValue = valueDiscountValue;
                }
                break;
            }
          }

          totalOrderRemain -= maxNonCombineDiscountAmount;
          totalOrderDiscountAmount += maxNonCombineDiscountAmount;

          if (applyPromotion)
            applyOrderPromotions.push({
              ...applyPromotion,
              amount: discountValue,
            });
        }

        if (canCombineOrderPromotion.length > 0) {
          for (const promotion of canCombinePercentDiscount) {
            let amount = totalOrderRemain * promotion.value * 0.01;
            if (
              promotion.valueLimitAmount &&
              amount > promotion.valueLimitAmount
            )
              amount = promotion.valueLimitAmount;

            totalOrderRemain -= amount;
            totalOrderDiscountAmount += amount;
            applyOrderPromotions.push({ ...promotion, amount });
          }

          for (const promotion of canCombineValueDiscount) {
            if (totalOrderRemain > 0) {
              const newPriceRemain = totalOrderRemain - promotion.value;
              totalOrderRemain = newPriceRemain >= 0 ? newPriceRemain : 0;
              if (newPriceRemain >= 0) {
                totalOrderDiscountAmount += promotion.value;
              }
              applyOrderPromotions.push({
                ...promotion,
                amount: promotion.value,
              });
            }
          }
        }

        const totalOrderAfterDiscount = totalOrderRemain;

        const createdOrder = await p.order.create({
          data: {
            status: OrderStatus.PENDING_PAYMENT,
            transactionStatus: OrderTransactionStatus.PENDING_PAYMENT,
            totalItemAfterDiscount,
            totalItemBeforeDiscount,
            totalItemDiscountAmount,
            totalOrderAfterDiscount,
            totalOrderBeforeDiscount,
            totalOrderDiscountAmount,
            userType: dto.type,
            expire: Date.now() + 20 * 60 * 1000,
            applyDiscounts: {
              createMany: {
                data: applyOrderPromotions.map((promo) => ({
                  combineWithOrderDiscount: promo.combinesWithOrderDiscount,
                  combineWithProductDiscount: promo.combinesWithProductDiscount,
                  discountAmount: promo.amount,
                  value: promo.value,
                  valueLimitAmount: promo.valueLimitAmount,
                  valueType: promo.valueType,
                  discountId: promo.id,
                })),
              },
            },
            history: {
              create: {
                action: OrderHistoryAction.CREATE,
                type: OrderHistoryType.CREATED,
                ...(dto.type === 'Customer' && actorId !== undefined
                  ? { changedCustomerId: String(actorId) }
                  : {}),
              },
            },
          },
        });

        for (const item of itemsAfterCalculate) {
          await p.orderItem.create({
            data: {
              quantity: item.quantity,
              discountAmount: item.discountAmount,
              priceAfterDiscount: item.priceAfterDiscount,
              priceBeforeDiscount: item.priceBeforeDiscount,
              totalDiscountAmount: item.discountAmount * item.quantity,
              totalPriceAfterDiscount: item.priceAfterDiscount * item.quantity,
              totalPriceBeforeDiscount:
                item.priceBeforeDiscount * item.quantity,
              sources: {
                createMany: {
                  data: item.itemsFrom,
                },
              },
              applyDiscounts: {
                createMany: {
                  data: item.applyPromotions.map((promo) => ({
                    combineWithOrderDiscount: promo.combinesWithOrderDiscount,
                    combineWithProductDiscount:
                      promo.combinesWithProductDiscount,
                    discountAmount: promo.amount,
                    discountId: promo.id,
                    value: promo.value,
                    valueLimitAmount: promo.valueLimitAmount,
                    valueType: promo.valueType,
                  })),
                },
              },
              orderId: createdOrder.id,
              productId: item.product.id,
              variantId: item.variant.id,
            },
          });
        }

        return { status: 200, body: { id: createdOrder.id } };
      },
      {
        maxWait: 15000,
        timeout: 15000,
      }
    );
  }
}
