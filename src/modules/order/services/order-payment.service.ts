import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CheckoutOrderDto,
  ConfirmPaymentReceivedDto,
  CreateTempOrderDto,
} from '../order.dto';
import { CartCheckoutService } from 'src/modules/cart/services/cart-checkout.service';
import { Response } from 'express';
import { OrderCalculationService } from './order-calculation.service';
import { OrderInventoryService } from './order-inventory.service';
import { DiscountService } from 'src/modules/discount/discount.service';
import { ActiveDiscount } from 'src/modules/discount/discount.type';
import {
  OrderHistoryAction,
  OrderHistoryType,
  OrderStatus,
  OrderTransactionStatus,
  PayOsParams,
} from '../order.type';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderCheckoutService } from './order-checkout.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderPayOsGatewayService } from './order-pay-os-gateway.service';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderCalculatationService: OrderCalculationService,
    private readonly orderInventoryService: OrderInventoryService,
    private readonly cartCheckoutService: CartCheckoutService,
    private readonly discountService: DiscountService,
    private readonly checkoutService: OrderCheckoutService,
    private readonly cancellationService: OrderCancellationService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly payOsGateway: OrderPayOsGatewayService
  ) {}

  async createTempOrder(dto: CreateTempOrderDto, req, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const items = await this.cartCheckoutService.getCartItemsData(
            p,
            dto.type,
            dto.cartItemIds
          );
          let totalItemBeforeDiscount = 0; // Tổng sản phẩm trước giảm giá
          let totalItemAfterDiscount = 0; // Tổng sản phẩm sau giảm giá
          let totalItemDiscountAmount = 0; // Tổng giá trị giảm giá sản phẩm

          // Kiểm tra tồn kho có đủ + Tính toán tổng tiền trước giảm giá
          for (const item of items) {
            totalItemBeforeDiscount += item.variant.sellPrice * item.quantity;
            const avaiable = item.variant.inventories.reduce(
              (total, inv) => total + inv.avaiable,
              0
            );

            if (avaiable < item.quantity) {
              return res.status(400).json({
                message: `Sản phẩm ${item.product.name} ${item.variant.title !== 'Default Title' ? `(${item.variant.title})` : ''} không còn đủ số lượng hoặc đã hết hàng. Vui lòng giảm số lượng`,
              });
            }
          }

          // Tính toán giá cuối cùng sản phẩm sau khuyến mại và lấy sản phẩm từ đâu

          const itemAfterCalculatePromises = items.map(async (item) => {
            const {
              applyPromotions,
              discountAmount,
              priceAfterDiscount,
              //   discountPercent,
            } = await this.orderCalculatationService.calculateItem(
              item,
              totalItemBeforeDiscount
            );
            totalItemAfterDiscount += priceAfterDiscount * item.quantity;
            totalItemDiscountAmount += discountAmount * item.quantity;

            // Tìm kiếm các lô hàng đủ số lượng
            // Cập nhật tồn kho và số lượng có sẵn của mỗi lô hàng
            const itemsFrom = await this.orderInventoryService.findItemReceive(
              item,
              p
            );

            return {
              ...item,
              quantity: item.quantity,
              priceBeforeDiscount: item.variant.sellPrice,
              priceAfterDiscount: priceAfterDiscount,
              discountAmount,
              applyPromotions,
              itemsFrom,
            };
          });

          const itemsAfterCalculate = await Promise.all(
            itemAfterCalculatePromises
          );

          // Tính toán giảm giá đơn hàng
          // Lưu lại số tiền sau mỗi giảm giá áp dụng
          const totalOrderBeforeDiscount = totalItemAfterDiscount;
          let totalOrderRemain = totalItemAfterDiscount;

          // Các khuyến mại đơn hàng hiện tại
          const activeOrderPromotions =
            await this.discountService.getActiveDiscounts({
              mode: ['promotion'],
              type: ['order'],
            });

          // Lọc ra các khuyến mại đơn hàng có thể áp dụng
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
                  if (items.length >= promotion.prerequisiteMinItem)
                    return true;
                  break;
              }
              return false;
            }
          );

          //Lọc ra các giảm giá đơn hàng có thể kết hợp và không kết hợp
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
          const applyOrderPromotions: Array<
            ActiveDiscount & { amount: number }
          > = [];

          // Tìm giảm giá đơn hàng không kết hợp lớn nhất
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
                    (maxNonCombineDiscountAmount = percentDiscountValue),
                      (applyPromotion = promotion);
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

            // Tính lại giá trị còn lại để giảm giá
            totalOrderRemain -= maxNonCombineDiscountAmount;
            totalOrderDiscountAmount += maxNonCombineDiscountAmount;

            // Lưu lại chương trình đã áp dụng (Nếu có)
            if (applyPromotion)
              applyOrderPromotions.push({
                ...applyPromotion,
                amount: discountValue,
              });
          }

          // Tính các giảm giá có kết hợp

          /**
           * Quy tắc kết hợp giảm giá đơn hàng kết hợp
           * Áp dụng tuần tự các giảm giá %
           * Áp dụng tuần tự các giảm giá cố định
           */

          if (canCombineOrderPromotion.length > 0) {
            // Tính giá trị giảm %
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

            // Tính giá trị giảm cố định (dừng khi giảm tới âm)
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
          // totalOrderRemain = Math.round(totalOrderRemain / 1000) * 1000;

          const totalOrderAfterDiscount = totalOrderRemain;

          // Tạo order
          const createdOrder = await p.order.create({
            data: {
              status: OrderStatus.PENDING_PAYMENT,
              // deliveryStatus: OrderDeliveryStatus.PENDING_PICKUP,
              transactionStatus: OrderTransactionStatus.PENDING_PAYMENT,
              totalItemAfterDiscount: totalItemAfterDiscount,
              totalItemBeforeDiscount: totalItemBeforeDiscount,
              totalItemDiscountAmount: totalItemDiscountAmount,
              totalOrderAfterDiscount: totalOrderAfterDiscount,
              totalOrderBeforeDiscount: totalOrderBeforeDiscount,
              totalOrderDiscountAmount: totalOrderDiscountAmount,
              userType: dto.type,
              expire: Date.now() + 20 * 60 * 1000,
              applyDiscounts: {
                createMany: {
                  data: applyOrderPromotions.map((promo) => {
                    return {
                      combineWithOrderDiscount: promo.combinesWithOrderDiscount,
                      combineWithProductDiscount:
                        promo.combinesWithProductDiscount,
                      discountAmount: promo.amount,
                      value: promo.value,
                      valueLimitAmount: promo.valueLimitAmount,
                      valueType: promo.valueType,
                      discountId: promo.id,
                    };
                  }),
                },
              },
              history: {
                create: {
                  action: OrderHistoryAction.CREATE,
                  type: OrderHistoryType.CREATED,
                  changedCustomerId:
                    dto.type === 'Customer' ? req.user.id : undefined,
                },
              },
            },
          });

          // Lưu các giảm giá áp dụng của sản phẩm
          for (const item of itemsAfterCalculate) {
            await p.orderItem.create({
              data: {
                quantity: item.quantity,
                discountAmount: item.discountAmount,
                priceAfterDiscount: item.priceAfterDiscount,
                priceBeforeDiscount: item.priceBeforeDiscount,
                totalDiscountAmount: item.discountAmount * item.quantity,
                totalPriceAfterDiscount:
                  item.priceAfterDiscount * item.quantity,
                totalPriceBeforeDiscount:
                  item.priceBeforeDiscount * item.quantity,
                sources: {
                  createMany: {
                    data: item.itemsFrom,
                  },
                },
                applyDiscounts: {
                  createMany: {
                    data: item.applyPromotions.map((promo) => {
                      return {
                        combineWithOrderDiscount:
                          promo.combinesWithOrderDiscount,
                        combineWithProductDiscount:
                          promo.combinesWithProductDiscount,
                        discountAmount: promo.amount,
                        discountId: promo.id,
                        value: promo.value,
                        valueLimitAmount: promo.valueLimitAmount,
                        valueType: promo.valueType,
                      };
                    }),
                  },
                },
                orderId: createdOrder.id,
                productId: item.product.id,
                variantId: item.variant.id,
              },
            });
          }

          return res.status(200).json({
            id: createdOrder.id,
          });
        },
        {
          maxWait: 15000,
          timeout: 15000,
        }
      );
    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      );

      return res
        .status(500)
        .json({ message: 'Đã xảy ra lỗi khi tạo hóa đơn. Vui lòng thử lại' });
    }
  }

  async cancelOrder(orderId: string) {
    return this.cancellationService.cancelTemporaryOrder(orderId);
  }

  async requestCancelOrder(orderId: string, res: Response) {
    try {
      await this.cancelOrder(orderId);
      return res.status(200).json({ message: 'Đã hủy giao dịch' });
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async checkoutOrder(dto: CheckoutOrderDto, res: Response) {
    const result = await this.checkoutService.checkout(dto);
    return res.status(result.status).json(result.body);
  }

  async createPaymentLinkWithPayOS(dto: CheckoutOrderDto, res: Response) {
    try {
      const result = await this.payOsGateway.createPaymentLink(dto);
      return res.status(result.status).json(result.body);
    } catch (error: unknown) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async cancelPayOSPayment(query: PayOsParams, res: Response) {
    await this.payOsGateway.clearPaymentCode(query.order);
    return res.redirect(this.payOsGateway.cancelRedirect(query));
  }

  async successPayOSPayment(query: PayOsParams, res: Response) {
    await this.payOsGateway.markPaymentSucceeded(query.order);
    return res.redirect(this.payOsGateway.successRedirect());
  }

  async cancelOrderByAdmin(
    dto: {
      orderId: string;
      isReStock: boolean;
      reason: string;
    },
    req,
    res: Response
  ) {
    try {
      await this.cancellationService.cancelByAdmin(dto, Number(req.user.id));
      return res.status(200).json({ message: 'Đã hủy đơn hàng' });
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async confirmPaymentReceived(
    dto: ConfirmPaymentReceivedDto,
    req,
    res: Response
  ) {
    try {
      await this.fulfillmentService.confirmPaymentReceived(
        dto.orderId,
        Number(req.user.id)
      );
      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error: unknown) {
      return res
        .status(500)
        .json(
          error instanceof Error
            ? error.message
            : 'Đã có lỗi xảy ra. Vui lòng thử lại'
        );
    }
  }
}
