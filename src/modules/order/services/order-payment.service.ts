import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';
import { CheckoutOrderDto, ConfirmPaymentReceivedDto, CreateTempOrderDto } from '../order.dto';
import { CartCustomerService } from 'src/modules/cart/services/cart-customer.service';
import { CartGuestService } from 'src/modules/cart/services/cart-guest.service';
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
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { MailService } from 'src/modules/mail/mail.service';
import PayOS from '@payos/node';
import { CheckoutRequestType } from '@payos/node/lib/type';

@Injectable()
export class OrderPaymentService {
  constructor(
    private prisma: PrismaService,
    private orderQueryService: OrderQueryService,
    private orderCalculatationService: OrderCalculationService,
    private orderInventoryService: OrderInventoryService,
    private customerCartService: CartCustomerService,
    private guestCartService: CartGuestService,
    private discountService: DiscountService,
    private mailService: MailService
  ) {}

  async createTempOrder(dto: CreateTempOrderDto, req, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          let items = undefined;
          switch (dto.type) {
            case 'Customer':
              items = await this.customerCartService.getCartItemsData(
                p,
                dto.cartItemIds
              );
              break;
            case 'Guest':
              items = await this.guestCartService.getCartItemsData(
                p,
                dto.cartItemIds
              );
              break;
          }
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
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .json({ message: 'Đã xảy ra lỗi khi tạo hóa đơn. Vui lòng thử lại' });
    }
  }

  async cancelOrder(orderId: string) {
    const order = await this.orderQueryService.getOrderDetail(orderId);

    if (!order)
      throw new Error('Không tìm thấy giao dịch hoặc giao dịch đã hủy');

    await this.prisma.$transaction(
      async (p) => {
        // Hoàn lại tồn kho
        for (const item of order.items) {
          for (const i of item.sources) {
            // Cập nhật lại tồn kho
            const inventory = await p.inventory.findFirst({
              where: {
                variant_id: item.variant.id,
                warehouse_id: i.warehouseId,
              },
            });
            await p.inventory.update({
              where: {
                id: inventory.id,
              },
              data: {
                avaiable: {
                  increment: i.quantity,
                },
                onTransaction: {
                  decrement: i.quantity,
                },
                histories: {
                  create: {
                    transactionAction:
                      InventoryTransactionAction.DELETE_TEMP_ORDER,
                    transactionType: InventoryTransactionType.ORDER,
                    avaiableQuantityChange: i.quantity,
                    onReceiveQuantityChange: i.quantity * -1,
                    newAvaiable: inventory.avaiable + i.quantity,
                    newOnTransaction: inventory.onTransaction - i.quantity,
                  },
                },
              },
            });
            // Cập nhật lại đơn nhập (Nếu có)
            if (i.receiveId) {
              await p.receiveItem.updateMany({
                where: {
                  receiveId: i.receiveId,
                  variantId: item.variantId,
                },
                data: {
                  quantityAvaiable: {
                    increment: i.quantity,
                  },
                },
              });
            }
          }
        }

        // Cập nhật lại số lần sử dụng voucher của voucher (Chưa có)
        if (order.applyVouchers.length > 0) {
          for (const voucher of order.applyVouchers) {
            await p.discount.update({
              where: {
                id: voucher.discountId,
              },
              data: {
                usage: {
                  decrement: 1,
                },
              },
            });
          }
        }

        await p.order.delete({
          where: {
            id: orderId,
          },
        });
      },
      {
        maxWait: 30000,
        timeout: 15000,
      }
    );
  }

  async requestCancelOrder(orderId: string, res: Response) {
    try {
      await this.cancelOrder(orderId);
      return res.status(200).json({ message: 'Đã hủy giao dịch' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }

  async checkoutOrder(dto: CheckoutOrderDto, res: Response) {
    await this.prisma.$transaction(async (p) => {
      const order = await p.order.findUnique({
        where: {
          id: dto.orderId,
        },
      });

      if (!order)
        return res.status(400).json({
          message: 'Giao dịch không tồn tại. Vui lòng tạo hóa đơn khác',
        });

      if (Date.now() > Number(order.expire)) {
        return res.status(400).json({
          message: 'Giao dịch đã hết hạn. Vui lòng tạo hóa đơn khác',
        });
      }

      const code = await generateCustomID('#', 'order', 'code', 6);

      const updateOrder = await p.order.update({
        where: {
          id: dto.orderId,
        },
        data: {
          code: code,
          address: dto.address.trim(),
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          email: dto.email.trim(),
          name: dto.name.trim(),
          phoneNumber: dto.phoneNumber.trim(),
          paymentMethod: dto.paymentMethod,
          note: dto.note ? dto.note.trim() : undefined,
          receiverPhoneNumber: dto.receivePhoneNumber
            ? dto.receivePhoneNumber.trim()
            : undefined,
          receiverName: dto.receiveName ? dto.receiveName.trim() : undefined,
          customerId: dto.customerId ? dto.customerId : undefined,
          status: OrderStatus.PENDING_PROCESSING,
        },
        include: {
          items: {
            select: {
              quantity: true,
              priceAfterDiscount: true,
              totalPriceAfterDiscount: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      this.mailService.sendUserCheckoutComplete(
        updateOrder,
        dto.email,
        dto.name
      );
    });

    return res.status(200).json({ message: 'Tạo đơn hàng thành công.' });
  }

  async createPaymentLinkWithPayOS(dto: CheckoutOrderDto, res: Response) {
    try {
      const order = await this.prisma.order.findUnique({
        where: {
          id: dto.orderId,
        },
      });

      if (!order)
        return res.status(400).json({
          message: 'Giao dịch không tồn tại. Vui lòng tạo hóa đơn khác',
        });

      if (Date.now() > Number(order.expire)) {
        return res.status(400).json({
          message: 'Giao dịch đã hết hạn. Vui lòng tạo hóa đơn khác',
        });
      }

      const payOS = new PayOS(
        process.env.PAYOS_CLIENT_ID,
        process.env.PAYOS_API_KEY,
        process.env.PAYOS_CHECKSUM_KEY
      );

      const orderCode = Date.now();
      const code = await generateCustomID('#', 'order', 'code', 6);

      await this.prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          code: code,
          address: dto.address.trim(),
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          email: dto.email,
          name: dto.name,
          paymentMethod: dto.paymentMethod,
          note: dto.note.trim(),
          receiverPhoneNumber: dto.receivePhoneNumber.trim(),
          receiverName: dto.receiveName.trim(),
          phoneNumber: dto.phoneNumber.trim(),
          customerId: dto.customerId ? dto.customerId : undefined,
          status: OrderStatus.PENDING_PROCESSING,
          payOSCode: orderCode.toString(),
        },
      });

      const checkoutRequest: CheckoutRequestType = {
        orderCode: orderCode,
        amount: order.totalOrderAfterDiscount,
        description: `Thanh toan don hang`,
        cancelUrl: `${process.env.SERVER_BASE_URL}/api/order/cancel/pay-os?order=${order.id}`,
        returnUrl: `${process.env.SERVER_BASE_URL}/api/order/success/pay-os?order=${order.id}`,
        buyerName: dto.name.trim(),
        buyerEmail: dto.email.trim(),
        buyerPhone: dto.phoneNumber.trim(),
        buyerAddress: `${[dto.address, dto.ward, dto.district, dto.province].join(', ')}`,
        expiredAt: Math.round(Number(order.expire) / 1000),
      };

      const response = await payOS.createPaymentLink(checkoutRequest);

      return res.status(200).json({ checkoutUrl: response.checkoutUrl });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async cancelPayOSPayment(query: PayOsParams, res: Response) {
    await this.prisma.order.update({
      where: {
        id: query.order,
      },
      data: {
        payOSCode: null,
      },
    });

    return res.redirect(
      `${process.env.CLIENT_BASE_URL}/checkout?order=${query.order}`
    );
  }

  async successPayOSPayment(query: PayOsParams, res: Response) {
    const order = await this.prisma.order.update({
      where: {
        id: query.order,
      },
      data: {
        transactionStatus: OrderTransactionStatus.PAID,
      },
    });

    this.mailService.sendUserCheckoutComplete(order, order.email, order.email);

    return res.redirect(`${process.env.CLIENT_BASE_URL}/checkout/success`);
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
      const { isReStock, orderId, reason } = dto;
      await this.prisma.$transaction(
        async (p) => {
          const order = await p.order.update({
            where: {
              id: orderId,
            },
            data: {
              status: OrderStatus.CANCEL,
              history: {
                create: {
                  action: OrderHistoryAction.CANCEL,
                  type: OrderHistoryType.ADJUSTMENT,
                  changedUserId: req.user.id,
                  reason: reason.trim(),
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
              // Lấy kho hàng
              const inventory = await p.inventory.findFirst({
                where: {
                  variant_id: item.variantId,
                  warehouse_id: source.warehouseId,
                },
              });

              // Cập nhật số lượng và lưu lịch sử kho hàng, đơn nhập
              if (source.receiveId && isReStock) {
                await p.receiveItem.updateMany({
                  where: {
                    receiveId: source.receiveId,
                    variantId: item.variantId,
                  },
                  data: {
                    quantityAvaiable: {
                      increment: source.quantity,
                    },
                  },
                });
              }

              await p.inventory.update({
                where: {
                  id: inventory.id,
                },
                data: {
                  avaiable: {
                    increment: isReStock ? source.quantity : 0,
                  },
                  onTransaction: {
                    decrement: source.quantity,
                  },
                  onHand: {
                    increment:
                      order.status === OrderStatus.IN_TRANSIT && isReStock
                        ? source.quantity
                        : 0,
                  },
                  histories: {
                    create: {
                      transactionAction:
                        InventoryTransactionAction.CANCEL_ORDER,
                      transactionType: InventoryTransactionType.ORDER,
                      newAvaiable: isReStock
                        ? inventory.avaiable + source.quantity
                        : inventory.avaiable,
                      newOnTransaction:
                        inventory.onTransaction - source.quantity,
                      newOnHand:
                        order.status === OrderStatus.IN_TRANSIT && isReStock
                          ? inventory.onHand + source.quantity
                          : inventory.onHand,
                      avaiableQuantityChange: isReStock ? source.quantity : 0,
                      OnTransactionQuantityChange: source.quantity * -1,
                      onHandQuantityChange:
                        order.status === OrderStatus.IN_TRANSIT
                          ? source.quantity
                          : 0,
                      changeUserId: req.user.id,
                      orderId: orderId,
                    },
                  },
                },
              });
            }
          }
        },
        {
          maxWait: 20000,
          timeout: 20000,
        }
      );
      return res.status(200).json({ message: 'Đã hủy đơn hàng' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }

  async confirmPaymentReceived(
    dto: ConfirmPaymentReceivedDto,
    req,
    res: Response
  ) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          // Cập nhật trạng thái đơn hàng
          const order = await p.order.update({
            where: {
              id: dto.orderId,
            },
            data: {
              status: OrderStatus.COMPLETE,
              transactionStatus: OrderTransactionStatus.PAID,
              history: {
                create: {
                  action: OrderHistoryAction.CONFIRM_PAYMENT,
                  type: OrderHistoryType.ADJUSTMENT,
                  changedUserId: req.user.id,
                },
              },
            },
            select: {
              id: true,
              items: {
                select: {
                  sources: true,
                  variantId: true,
                },
              },
            },
          });

          // Cập nhật số lượng giao dịch (Do đã hoàn thành giao dịch)
          for (const item of order.items) {
            for (const source of item.sources) {
              const inventory = await p.inventory.findFirst({
                where: {
                  variant_id: item.variantId,
                  warehouse_id: source.warehouseId,
                },
              });

              await p.inventory.update({
                where: {
                  id: inventory.id,
                },
                data: {
                  onTransaction: { decrement: source.quantity },
                  histories: {
                    create: {
                      transactionAction:
                        InventoryTransactionAction.DELIVERY_COMPLETE,
                      transactionType: InventoryTransactionType.ORDER,
                      OnTransactionQuantityChange: source.quantity * -1,
                      newOnTransaction:
                        inventory.onTransaction * source.quantity,
                      changeUserId: req.user.id,
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
      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json(error.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại');
    }
  }
}
