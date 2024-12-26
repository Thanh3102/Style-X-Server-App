import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTempOrderDto } from './order.dto';
import { Response } from 'express';
import {
  CartItem,
  CheckoutOrderDto,
  ConfirmPaymentReceivedDto,
  FormatOrder,
  FormatOrderDetail,
  OrderDetail,
  OrderHistoryAction,
  OrderHistoryType,
  OrderListResponseData,
  OrderStatus,
  OrderTransactionStatus,
  PayOsParams,
  PrismaTransactionObject,
  Voucher,
} from './order.type';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
  QueryParams,
} from 'src/utils/types';
import { ActiveDiscount } from '../discount/discount.type';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { MailService } from '../mail/mail.service';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { tranformCreatedOnParams } from 'src/utils/helper/DateHelper';
import PayOS from '@payos/node';
import { CheckoutRequestType } from '@payos/node/lib/type';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  @Cron('0 * * * * *')
  async deleteExpireOrder() {
    const expireOrders = await this.prisma.order.findMany({
      where: {
        code: null,
        expire: {
          lt: Date.now(),
        },
      },
      select: {
        id: true,
      },
    });

    for (const order of expireOrders) {
      await this.cancelOrder(order.id);
    }
  }

  async getCartItemsData(
    prisma: PrismaTransactionObject,
    type: 'Customer' | 'Guest',
    ids: number[],
  ) {
    if (type === 'Customer') {
      const items = await prisma.cartItem.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        select: {
          id: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          variant: {
            select: {
              id: true,
              sellPrice: true,
              costPrice: true,
              title: true,
              inventories: {
                select: {
                  avaiable: true,
                },
              },
            },
          },
          quantity: true,
        },
      });

      return items;
    } else {
      const items = await prisma.guestCartItem.findMany({
        where: {
          id: {
            in: ids,
          },
        },
        select: {
          id: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          variant: {
            select: {
              id: true,
              costPrice: true,
              sellPrice: true,
              title: true,
              inventories: {
                select: {
                  avaiable: true,
                },
              },
            },
          },
          quantity: true,
        },
      });
      return items;
    }
  }

  async getActiveDiscounts(
    prisma: PrismaTransactionObject,
    options: {
      mode: Array<'coupon' | 'promotion'>;
      type: Array<'product' | 'order'>;
    },
  ) {
    const { mode, type } = options;

    try {
      const discounts = await prisma.discount.findMany({
        where: {
          active: true,
          void: false,
          mode: {
            in: mode,
          },
          type: {
            in: type,
          },
          startOn: {
            lte: new Date(),
          },
          OR: [
            {
              endOn: null,
            },
            {
              endOn: {
                gte: new Date(),
              },
            },
          ],
        },
        include: {
          entitleCategories: {
            select: {
              category: {
                select: {
                  id: true,
                },
              },
            },
          },
          entitleProducts: {
            select: {
              product: {
                select: {
                  id: true,
                },
              },
            },
          },
          entitleVariants: {
            select: {
              variant: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      const responseDiscounts = discounts.map((discount) => {
        const { entitleCategories, entitleProducts, entitleVariants, ...rest } =
          discount;

        const productIds = entitleProducts.map((item) => item.product.id);
        const variantIds = entitleVariants.map((item) => item.variant.id);
        const categoryIds = entitleCategories.map((item) => item.category.id);
        return {
          ...rest,
          productIds,
          variantIds,
          categoryIds,
        };
      });

      return responseDiscounts;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async calculateItem(
    item: CartItem,
    totalPriceBeforeDiscount: number,
    prisma: PrismaTransactionObject,
  ) {
    // Giá trước khi giảm giá
    // Tính toán giá sản phẩm sau khuyến mại
    const activeProductPromotions = await this.getActiveDiscounts(prisma, {
      mode: ['promotion'],
      type: ['product'],
    });

    const affectedPromotions = activeProductPromotions.filter((promotion) => {
      if (promotion.entitle === 'all' && promotion.prerequisite === 'none') {
        return true;
      }

      if (
        promotion.entitle !== 'all' &&
        !promotion.variantIds.includes(item.variant.id)
      ) {
        return false;
      }
      if (promotion.prerequisite !== 'none') {
        switch (promotion.prerequisite) {
          case 'prerequisiteMinTotal':
            if (totalPriceBeforeDiscount < promotion.prerequisiteMinTotal)
              return false;
            break;

          case 'prerequisiteMinItemTotal':
            const totalItemBeforeDiscount =
              item.variant.sellPrice * item.quantity;
            if (totalItemBeforeDiscount < promotion.prerequisiteMinItemTotal)
              return false;
            break;

          case 'prerequisiteMinItem':
            if (item.quantity < promotion.prerequisiteMinItem) return false;
            break;
        }
      }
      return true;
    });
    // Các khuyến mại đã áp dụng
    const applyPromotions: Array<
      (typeof activeProductPromotions)[0] & { amount: number }
    > = [];
    // Giá còn lại để thực hiểm giảm giá
    let priceRemain = item.variant.sellPrice;
    // Giá trị đã giảm
    let discountAmount = 0;
    // Danh sách các khuyến mại không thể kết hợp
    const notCombinePromotions = affectedPromotions.filter(
      (item) => !item.combinesWithProductDiscount,
    );
    // Danh sách các khuyến mại có thể kết hợp
    const combinePromotions = affectedPromotions.filter(
      (item) => item.combinesWithProductDiscount,
    );

    // Lọc các khuyến mại có thể kết hợp theo loại
    const combineValuePromotions = combinePromotions.filter(
      (item) => item.valueType === 'value',
    );
    const combinePercentPromotions = combinePromotions.filter(
      (item) => item.valueType === 'percent',
    );
    const combineFlatPromotions = combinePromotions.filter(
      (item) => item.valueType === 'flat',
    );

    // Tìm khuyến mại sản phẩm không kết hợp có giá trị giảm lớn nhất (nếu có)
    if (notCombinePromotions.length > 0) {
      let maxNotCombineDiscountValue = 0;
      let applyPromotion: (typeof activeProductPromotions)[0] | null = null;
      for (const promotion of notCombinePromotions) {
        switch (promotion.valueType) {
          case 'flat':
            const flatDiscountValue =
              promotion.value < item.variant.sellPrice ? promotion.value : null;
            if (
              flatDiscountValue &&
              flatDiscountValue > maxNotCombineDiscountValue
            ) {
              maxNotCombineDiscountValue = flatDiscountValue;
              applyPromotion = promotion;
            }
            break;
          case 'percent':
            let percentDiscountValue = Math.round(
              item.variant.sellPrice * promotion.value * 0.01,
            );
            if (promotion.valueLimitAmount) {
              percentDiscountValue =
                percentDiscountValue <= promotion.valueLimitAmount
                  ? percentDiscountValue
                  : promotion.valueLimitAmount;
            }
            if (percentDiscountValue > maxNotCombineDiscountValue) {
              (maxNotCombineDiscountValue = percentDiscountValue),
                (applyPromotion = promotion);
            }
            break;
          case 'value':
            const valueDiscountValue =
              item.variant.sellPrice - promotion.value >= 0
                ? item.variant.sellPrice - promotion.value
                : 0;
            if (valueDiscountValue > maxNotCombineDiscountValue) {
              maxNotCombineDiscountValue = valueDiscountValue;
              applyPromotion = promotion;
            }
            break;
        }
      }
      // Tính giá trị còn lại để giảm
      priceRemain -= maxNotCombineDiscountValue;
      discountAmount += maxNotCombineDiscountValue;
      // Lưu lại chương trình đã áp dụng (Nếu có)
      if (applyPromotion)
        applyPromotions.push({
          ...applyPromotion,
          amount: maxNotCombineDiscountValue,
        });
    }

    /**
     * Quy tắc kết hợp giảm giá sản phẩm kết hợp
     * Chọn ra đồng giá nhỏ nhất
     * Áp dụng tuần tự các giảm giá %
     * Áp dụng tuần tự các giảm giá cố định
     */

    if (combinePromotions.length > 0) {
      // Tìm giảm giá đồng giá nhỏ nhất
      const minFlatPromotion = combineFlatPromotions.reduce((min, current) => {
        if (min) {
          return current.value < min.value ? current : min;
        }
        return current;
      }, null);

      if (minFlatPromotion && minFlatPromotion.value < priceRemain) {
        priceRemain = minFlatPromotion.value;
        discountAmount += minFlatPromotion.value;
        applyPromotions.push({
          ...minFlatPromotion,
          amount: minFlatPromotion.value,
        });
      }

      // Tính giá trị giảm %
      for (const promotion of combinePercentPromotions) {
        let amount = priceRemain * promotion.value * 0.01;
        if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
          amount = promotion.valueLimitAmount;
        priceRemain -= amount;
        discountAmount += amount;
        applyPromotions.push({ ...promotion, amount });
      }

      // Tính giá trị giảm cố định (dừng khi giảm tới âm)
      for (const promotion of combineValuePromotions) {
        if (priceRemain > 0) {
          const newPriceRemain = priceRemain - promotion.value;
          priceRemain = newPriceRemain >= 0 ? newPriceRemain : 0;
          if (newPriceRemain >= 0) {
            discountAmount += promotion.value;
          }
          applyPromotions.push({ ...promotion, amount: promotion.value });
        }
      }
    }

    priceRemain = Math.round(priceRemain / 1000) * 1000;
    let priceAfterDiscount: null | number = item.variant.sellPrice;
    let discountPercent: null | number = null;
    if (discountAmount !== 0) {
      priceAfterDiscount = item.variant.sellPrice - discountAmount;
      discountPercent = Math.floor(
        ((item.variant.sellPrice - priceAfterDiscount) /
          item.variant.sellPrice) *
          100,
      );
    }

    return {
      priceAfterDiscount,
      discountPercent,
      discountAmount,
      applyPromotions,
      activePromotions: affectedPromotions,
    };
  }

  async findItemReceive(item: CartItem, p: PrismaTransactionObject) {
    // Lọc ra các lô hàng có sản phẩm này (Xếp theo lô hàng nhập lâu nhất còn hàng và theo thứ tự kho )
    const receiveItems = await p.receiveItem.findMany({
      where: {
        variantId: item.variant.id,
        quantityAvaiable: {
          gt: 0,
        },
      },
      include: {
        receiveInventory: {
          select: {
            id: true,
            warehouseId: true,
          },
        },
      },
      orderBy: {
        receiveInventory: {
          createdAt: 'asc',
          //   warehouseId: 'desc',
        },
      },
    });

    // Lưu lại sản phẩm được lấy từ đâu
    const itemsFrom: {
      receiveId: number | null;
      warehouseId: number;
      quantity: number;
      costPrice: number;
    }[] = [];

    // Số lượng sản phẩm cần lấy còn lại
    let itemQuantityNeedRemain = item.quantity;
    for (const receiveItem of receiveItems) {
      const inventory = await p.inventory.findFirst({
        where: {
          warehouse_id: receiveItem.receiveInventory.warehouseId,
          variant_id: item.variant.id,
          warehouse: {
            active: true,
          },
        },
      });
      if (itemQuantityNeedRemain === 0) break;
      // Nếu số lượng có sẵn > số lượng cần lấy
      if (receiveItem.quantityAvaiable > itemQuantityNeedRemain) {
        // Update Giảm số lượng có sản trong lô hàng đó
        await p.receiveItem.update({
          where: {
            id: receiveItem.id,
          },
          data: {
            quantityAvaiable: {
              decrement: itemQuantityNeedRemain,
            },
          },
        });

        // Update tồn kho -> giao dịch ở kho đã lấy
        await p.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            avaiable: {
              decrement: itemQuantityNeedRemain,
            },
            histories: {
              create: {
                transactionType: InventoryTransactionType.ORDER,
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                avaiableQuantityChange: itemQuantityNeedRemain * -1,
                OnTransactionQuantityChange: itemQuantityNeedRemain,
                newAvaiable: inventory.avaiable - itemQuantityNeedRemain,
                newOnTransaction:
                  inventory.onTransaction + itemQuantityNeedRemain,
              },
            },
          },
        });

        // Lưu lại nơi đã lấy
        itemsFrom.push({
          quantity: itemQuantityNeedRemain,
          receiveId: receiveItem.receiveInventory.id,
          warehouseId: receiveItem.receiveInventory.warehouseId,
          costPrice: receiveItem.finalPrice,
        });
        // Giảm số lượng cần lấy về 0
        itemQuantityNeedRemain = 0;
      } else {
        await p.receiveItem.update({
          where: {
            id: receiveItem.id,
          },
          data: {
            quantityAvaiable: 0,
          },
        });

        // Update tồn kho -> giao dịch ở kho đã lấy
        await p.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            avaiable: {
              decrement: itemQuantityNeedRemain,
            },
            onTransaction: {
              increment: itemQuantityNeedRemain,
            },
            histories: {
              create: {
                transactionType: InventoryTransactionType.ORDER,
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                avaiableQuantityChange: itemQuantityNeedRemain * -1,
                OnTransactionQuantityChange: itemQuantityNeedRemain,
                newAvaiable: inventory.avaiable - itemQuantityNeedRemain,
                newOnTransaction:
                  inventory.onTransaction + itemQuantityNeedRemain,
              },
            },
          },
        });

        itemsFrom.push({
          quantity: receiveItem.quantityAvaiable,
          receiveId: receiveItem.receiveInventory.id,
          warehouseId: receiveItem.receiveInventory.warehouseId,
          costPrice: receiveItem.finalPrice,
        });

        // Giảm số lượng cần lấy còn lại
        itemQuantityNeedRemain -= receiveItem.quantityAvaiable;
      }
    }

    /* 
      Nếu đã lặp qua các đơn nhập và còn thiếu 
      -> Kiểm tra tồn kho thực tế  (Do thêm vào thủ công) 
    */
    const inventories = await p.inventory.findMany({
      where: {
        variant_id: item.variant.id,
      },
    });

    for (const inv of inventories) {
      if (itemQuantityNeedRemain === 0) break;
      if (inv.avaiable > itemQuantityNeedRemain) {
        await p.inventory.update({
          where: {
            id: inv.id,
          },
          data: {
            avaiable: {
              decrement: itemQuantityNeedRemain,
            },
            onTransaction: {
              increment: itemQuantityNeedRemain,
            },
            histories: {
              create: {
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                transactionType: InventoryTransactionType.ORDER,
                newAvaiable: inv.avaiable - itemQuantityNeedRemain,
                newOnTransaction: inv.onTransaction + itemQuantityNeedRemain,
                avaiableQuantityChange: itemQuantityNeedRemain * -1,
                OnTransactionQuantityChange: itemQuantityNeedRemain,
              },
            },
          },
        });
        itemsFrom.push({
          costPrice: item.variant.costPrice,
          receiveId: null,
          quantity: itemQuantityNeedRemain,
          warehouseId: inv.warehouse_id,
        });
        // Đặt lại số lượng cần lấy
        itemQuantityNeedRemain = 0;
      } else {
        await p.inventory.update({
          where: {
            id: inv.id,
          },
          data: {
            avaiable: 0,
            onTransaction: {
              increment: inv.avaiable,
            },
            histories: {
              create: {
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                transactionType: InventoryTransactionType.ORDER,
                newAvaiable: 0,
                newOnTransaction: inv.onTransaction + inv.avaiable,
                avaiableQuantityChange: inv.avaiable * -1,
                OnTransactionQuantityChange: inv.avaiable,
              },
            },
          },
        });
        itemsFrom.push({
          costPrice: item.variant.costPrice,
          receiveId: null,
          quantity: inv.avaiable,
          warehouseId: inv.warehouse_id,
        });
        // Đặt lại số lượng cần lấy
        itemQuantityNeedRemain -= inv.avaiable;
      }
    }

    // Nếu không còn hàng ở đơn nhập và ở kho thực tế -> Lỗi tính toán tồn kho
    if (itemQuantityNeedRemain > 0)
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi tính toán hóa đơn. Vui lòng tạo hóa đơn khác',
      );

    return itemsFrom;
  }

  async createTempOrder(dto: CreateTempOrderDto, req, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const items = await this.getCartItemsData(
            p,
            dto.type,
            dto.cartItemIds,
          );

          let totalItemBeforeDiscount = 0; // Tổng sản phẩm trước giảm giá
          let totalItemAfterDiscount = 0; // Tổng sản phẩm sau giảm giá
          let totalItemDiscountAmount = 0; // Tổng giá trị giảm giá sản phẩm

          // Kiểm tra tồn kho có đủ + Tính toán tổng tiền trước giảm giá
          for (const item of items) {
            totalItemBeforeDiscount += item.variant.sellPrice * item.quantity;
            const avaiable = item.variant.inventories.reduce(
              (total, inv) => total + inv.avaiable,
              0,
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
            } = await this.calculateItem(item, totalItemBeforeDiscount, p);
            totalItemAfterDiscount += priceAfterDiscount * item.quantity;
            totalItemDiscountAmount += discountAmount * item.quantity;

            // Tìm kiếm các lô hàng đủ số lượng
            // Cập nhật tồn kho và số lượng có sẵn của mỗi lô hàng
            const itemsFrom = await this.findItemReceive(item, p);

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
            itemAfterCalculatePromises,
          );

          // Tính toán giảm giá đơn hàng
          // Lưu lại số tiền sau mỗi giảm giá áp dụng
          const totalOrderBeforeDiscount = totalItemAfterDiscount;
          let totalOrderRemain = totalItemAfterDiscount;

          // Các khuyến mại đơn hàng hiện tại
          const activeOrderPromotions = await this.getActiveDiscounts(p, {
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
            },
          );

          //Lọc ra các giảm giá đơn hàng có thể kết hợp và không kết hợp
          const canCombineOrderPromotion = affectedOrderPromotions.filter(
            (promo) => promo.combinesWithOrderDiscount,
          );

          const canCombineValueDiscount = canCombineOrderPromotion.filter(
            (promo) => promo.valueType === 'value',
          );

          const canCombinePercentDiscount = canCombineOrderPromotion.filter(
            (promo) => promo.valueType === 'percent',
          );

          const cannotCombineOrderPromotion = affectedOrderPromotions.filter(
            (promo) => !promo.combinesWithOrderDiscount,
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
                    totalItemAfterDiscount * promotion.value * 0.01,
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
        },
      );
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .json({ message: 'Đã xảy ra lỗi khi tạo hóa đơn. Vui lòng thử lại' });
    }
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        totalItemAfterDiscount: true,
        totalItemBeforeDiscount: true,
        totalItemDiscountAmount: true,
        totalOrderAfterDiscount: true,
        totalOrderBeforeDiscount: true,
        totalOrderDiscountAmount: true,
        expire: true,

        items: {
          include: {
            product: {
              select: {
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                title: true,
                image: true,
              },
            },
          },
        },
      },
    });
    return order;
  }

  async getOrderDetail(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                id: true,
                title: true,
                image: true,
              },
            },
            applyDiscounts: {
              include: {
                discount: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                  },
                },
              },
            },
            sources: {
              select: {
                id: true,
                costPrice: true,
                quantity: true,
                warehouseId: true,
                receiveId: true,
                receive: {
                  select: {
                    id: true,
                    code: true,
                  },
                },
                warehouse: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        applyDiscounts: {
          include: {
            discount: {
              select: {
                id: true,
                title: true,
                description: true,
              },
            },
          },
        },
        history: {
          select: {
            id: true,
            action: true,
            type: true,
            reason: true,
            createdAt: true,
            changedEmployee: {
              select: {
                id: true,
                name: true,
              },
            },
            changedCustomer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        applyVouchers: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return order;
  }

  async fetchOrder(orderId: string, res: Response) {
    const order = await this.getOrder(orderId);

    if (!order)
      return res.status(404).json({
        message:
          'Hóa đơn không tồn tại hoặc đã hết thời gian giao dịch. Vui lòng tạo hóa đơn mới',
      });

    if (Date.now() > order.expire) {
      return res.status(400).json({
        message: 'Phiên giao dịch đã hết hạn. Vui lòng tạo hóa đơn mới',
      });
    }

    return res.status(200).json({ ...order, expire: Number(order.expire) });
  }

  async cancelOrder(orderId: string) {
    const order = await this.getOrderDetail(orderId);

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
      },
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

  async checkoutOrder(dto: CheckoutOrderDto, req, res: Response) {
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
          address: dto.address,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          email: dto.email,
          name: dto.name,
          paymentMethod: dto.paymentMethod,
          note: dto.note,
          receiverPhoneNumber: dto.receivePhoneNumber,
          receiverName: dto.receiveName,
          phoneNumber: dto.phoneNumber,
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
        dto.name,
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
        process.env.PAYOS_CHECKSUM_KEY,
      );

      const orderCode = Date.now();
      const code = await generateCustomID('#', 'order', 'code', 6);

      await this.prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          code: code,
          address: dto.address,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          email: dto.email,
          name: dto.name,
          paymentMethod: dto.paymentMethod,
          note: dto.note,
          receiverPhoneNumber: dto.receivePhoneNumber,
          receiverName: dto.receiveName,
          phoneNumber: dto.phoneNumber,
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
        buyerName: dto.name,
        buyerEmail: dto.email,
        buyerPhone: dto.phoneNumber,
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
      `${process.env.CLIENT_BASE_URL}/checkout?order=${query.order}`,
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

  async applyVoucher(orderId: string, voucherCode: string, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const orderDetail = await this.getOrderDetail(orderId);
          const voucher = await this.findVoucher(voucherCode);

          if (!voucher) throw new Error('Mã giảm giá không tồn tại');

          // Kiểm tra có thể sử dụng voucher
          await this.checkVoucherValid(p, orderDetail, voucher);

          if (voucher.type === 'product') {
            await this.handleApplyProductVoucher(p, orderDetail, voucher);
          }

          if (voucher.type === 'order') {
            await this.handleApplyOrderVoucher(p, orderDetail, voucher);
          }
        },
        {
          maxWait: 30000,
          timeout: 30000,
        },
      );

      return res
        .status(200)
        .json({ message: 'Sử dụng mã giảm giá thành công' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async handleApplyProductVoucher(
    p: PrismaTransactionObject,
    order: OrderDetail,
    voucher: Voucher,
  ) {
    let applyItems: OrderDetail['items'][number][] = [];

    switch (voucher.entitle) {
      case 'all':
        applyItems = order.items;
        break;

      case 'entitledProduct':
        applyItems = order.items.filter((item) =>
          voucher.entitleVariants.includes(item.variantId),
        );
        break;
      case 'entitledCategory':
        const applyVariantIds = await this.findVariantIdByCategoryId(
          voucher.entitleCategories,
        );

        applyItems = order.items.filter((item) =>
          applyVariantIds.includes(item.variantId),
        );
        break;
    }

    if (applyItems.length === 0) {
      throw new Error('Không có sản phẩm khuyến mại phù hợp');
    }

    // Kiểm tra điều kiện sử dụng
    switch (voucher.prerequisite) {
      case 'prerequisiteMinItem':
        let totalItems = 0;
        for (const item of applyItems) {
          totalItems += item.quantity;
        }
        if (totalItems < voucher.prerequisiteMinItem)
          throw new Error(
            `Tổng số lượng sản phẩm khuyến mại phải lớn hơn ${voucher.prerequisiteMinItem}`,
          );
        break;

      case 'prerequisiteMinItemTotal':
        let totalItemsPrice = 0;
        for (const item of applyItems) {
          totalItemsPrice += item.totalPriceBeforeDiscount;
        }
        if (totalItemsPrice < voucher.prerequisiteMinItemTotal)
          throw new Error(
            `Tổng giá trị sản phẩm khuyến mại phải lớn hơn ${voucher.prerequisiteMinItemTotal} VNĐ`,
          );
        break;

      case 'prerequisiteMinTotal':
        if (order.totalOrderBeforeDiscount < voucher.prerequisiteMinTotal)
          throw new Error(
            `Tổng giá trị đơn hàng phải lớn hơn ${voucher.prerequisiteMinTotal} VNĐ`,
          );
        break;
    }

    // Update thông tin sản phẩm giảm giá
    let totalVoucherItemDiscountAmount = 0;

    for (const item of applyItems) {
      let newPriceAfterDiscount = item.priceAfterDiscount; // Tính lại giá mới
      let discountAmount = 0; //Giá trị đã giảm
      switch (voucher.valueType) {
        // Đồng giá (Đồng giá chỉ có ở chương trình khuyến mại)
        // case 'flat':
        //   if (voucher.value >= item.priceAfterDiscount)
        //     throw new Error(
        //       'Không thể áp dụng do giá đồng giá lớn hơn giá sản phẩm thanh toán',
        //     );
        //   newPriceAfterDiscount = voucher.value;
        //   discountAmount += Number(
        //     item.priceAfterDiscount - newPriceAfterDiscount,
        //   );
        //   break;
        case 'percent':
          let percentDiscountAmount =
            item.priceAfterDiscount * voucher.value * 0.01;
          if (voucher.valueLimitAmount) {
            percentDiscountAmount =
              percentDiscountAmount > voucher.valueLimitAmount
                ? voucher.valueLimitAmount
                : percentDiscountAmount;
          }
          newPriceAfterDiscount =
            item.priceAfterDiscount - percentDiscountAmount;
          discountAmount += Number(percentDiscountAmount);
          break;

        case 'value':
          let valueDiscountAmount = voucher.value;
          if (valueDiscountAmount > item.priceAfterDiscount)
            valueDiscountAmount = item.priceAfterDiscount;
          newPriceAfterDiscount = item.priceAfterDiscount - valueDiscountAmount;
          discountAmount += valueDiscountAmount;
          break;
      }

      // Lưu lại tổng giảm giá sản phẩm
      totalVoucherItemDiscountAmount += discountAmount * item.quantity;

      const newTotalPriceAfterDiscount = newPriceAfterDiscount * item.quantity;
      const newTotalDiscountAmount = discountAmount * item.quantity;

      await p.orderItem.update({
        where: {
          id: item.id,
        },
        data: {
          priceAfterDiscount: newPriceAfterDiscount,
          discountAmount: {
            increment: discountAmount,
          },
          totalPriceAfterDiscount: newTotalPriceAfterDiscount,
          totalDiscountAmount: newTotalDiscountAmount,
        },
      });

      await p.orderItemApplyDiscount.create({
        data: {
          combineWithOrderDiscount: voucher.combinesWithOrderDiscount,
          combineWithProductDiscount: voucher.combinesWithProductDiscount,
          discountAmount: discountAmount,
          value: voucher.value,
          valueType: voucher.valueType,
          valueLimitAmount: voucher.valueLimitAmount,
          discountId: voucher.id,
          orderItemId: item.id,
        },
      });
    }

    // Update thông tin đơn hàng
    await p.order.update({
      where: {
        id: order.id,
      },
      data: {
        totalItemAfterDiscount:
          order.totalItemAfterDiscount - totalVoucherItemDiscountAmount,
        totalItemDiscountAmount:
          order.totalItemDiscountAmount + totalVoucherItemDiscountAmount,
        totalOrderAfterDiscount:
          order.totalItemAfterDiscount - totalVoucherItemDiscountAmount,
      },
    });

    // Tính toán lại giảm giá hóa đơn nếu có
    if (order.applyDiscounts.length > 0) {
      const totalItemAfterDiscount =
        order.totalItemAfterDiscount - totalVoucherItemDiscountAmount;
      // Giá trị còn lại để giảm
      let totalOrderRemain = totalItemAfterDiscount;

      // Các khuyến mại đơn hàng đã áp dụng
      const activeOrderPromotions = order.applyDiscounts;

      //Lọc ra các giảm giá đơn hàng có thể kết hợp và không kết hợp
      const canCombineOrderPromotion = activeOrderPromotions.filter(
        (promo) => promo.combineWithOrderDiscount,
      );

      const canCombineValueDiscount = canCombineOrderPromotion.filter(
        (promo) => promo.valueType === 'value',
      );

      const canCombinePercentDiscount = canCombineOrderPromotion.filter(
        (promo) => promo.valueType === 'percent',
      );

      const cannotCombineOrderPromotion = activeOrderPromotions.filter(
        (promo) => !promo.combineWithOrderDiscount,
      );

      let totalOrderDiscountAmount = 0;

      // Tìm giảm giá đơn hàng không kết hợp lớn nhất
      if (cannotCombineOrderPromotion.length > 0) {
        let maxNonCombineDiscountAmount = -1;
        let discountValue = 0;
        let applyPromotion = null;
        for (const promotion of cannotCombineOrderPromotion) {
          switch (promotion.valueType) {
            case 'percent':
              let percentDiscountValue = Math.round(
                totalItemAfterDiscount * promotion.value * 0.01,
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
          if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
            amount = promotion.valueLimitAmount;

          totalOrderRemain -= amount;
          totalOrderDiscountAmount += amount;
        }

        // Tính giá trị giảm cố định (dừng khi giảm tới âm)
        for (const promotion of canCombineValueDiscount) {
          if (totalOrderRemain > 0) {
            const newPriceRemain = totalOrderRemain - promotion.value;
            totalOrderRemain = newPriceRemain >= 0 ? newPriceRemain : 0;
            if (newPriceRemain >= 0) {
              totalOrderDiscountAmount += promotion.value;
            }
          }
        }
      }
      // totalOrderRemain = Math.round(totalOrderRemain / 1000) * 1000;

      const totalOrderAfterDiscount = totalOrderRemain;
      await p.order.update({
        where: {
          id: order.id,
        },
        data: {
          totalOrderAfterDiscount: totalOrderAfterDiscount,
          totalOrderDiscountAmount: totalOrderDiscountAmount,
        },
      });
    }

    // Thêm voucher vào danh sách voucher đã sử dụng
    await p.orderApplyVoucher.create({
      data: {
        discountId: voucher.id,
        orderId: order.id,
      },
    });

    // Tăng số lần sử dụng voucher
    await p.discount.update({
      where: {
        id: voucher.id,
      },
      data: {
        usage: {
          increment: 1,
        },
      },
    });
  }

  async handleApplyOrderVoucher(
    p: PrismaTransactionObject,
    order: OrderDetail,
    voucher: Voucher,
  ) {
    // Kiểm tra điều kiện áp dụng
    switch (voucher.prerequisite) {
      case 'prerequisiteMinItem':
        let totalItems = 0;
        for (const item of order.items) {
          totalItems += item.quantity;
        }
        if (totalItems < voucher.prerequisiteMinItem)
          throw new Error(
            `Tổng số lượng sản phẩm trong đơn phải lớn hơn ${voucher.prerequisiteMinItem}`,
          );
        break;

      case 'prerequisiteMinTotal':
        if (order.totalOrderBeforeDiscount < voucher.prerequisiteMinTotal)
          throw new Error(
            `Tổng giá trị đơn hàng phải lớn hơn ${voucher.prerequisiteMinTotal} VNĐ`,
          );
        break;
    }

    // Tính lại thông tin đơn hàng
    let discountValue = 0;
    switch (voucher.valueType) {
      case 'percent':
        discountValue = order.totalItemAfterDiscount * voucher.value * 0.01;
        break;
      case 'value':
        discountValue = order.totalItemAfterDiscount * voucher.value * 0.01;
        if (
          voucher.valueLimitAmount &&
          discountValue > voucher.valueLimitAmount
        ) {
          discountValue = voucher.valueLimitAmount;
        }

        if (discountValue > order.totalOrderAfterDiscount)
          discountValue = order.totalOrderAfterDiscount;
        break;
    }

    let newTotalOrderAfterDiscount =
      order.totalOrderAfterDiscount - discountValue;
    let newTotalOrderDiscountAmount =
      order.totalOrderDiscountAmount + discountValue;

    // Update lại tổng giá trị đơn hàng
    await p.order.update({
      where: {
        id: order.id,
      },
      data: {
        totalOrderAfterDiscount: newTotalOrderAfterDiscount,
        totalOrderDiscountAmount: newTotalOrderDiscountAmount,
      },
    });

    // Thêm khuyến mại vào danh sách khuyến mại áp dụng cho đơn hàng
    await p.orderApplyDiscount.create({
      data: {
        combineWithOrderDiscount: voucher.combinesWithOrderDiscount,
        combineWithProductDiscount: voucher.combinesWithProductDiscount,
        discountAmount: discountValue,
        value: voucher.value,
        valueType: voucher.valueType,
        valueLimitAmount: voucher.valueLimitAmount,
        discountId: voucher.id,
        orderId: order.id,
      },
    });

    // Thêm voucher vào danh sách voucher đã sử dụng
    await p.orderApplyVoucher.create({
      data: {
        discountId: voucher.id,
        orderId: order.id,
      },
    });

    // Tăng số lần sử dụng voucher
    await p.discount.update({
      where: {
        id: voucher.id,
      },
      data: {
        usage: {
          increment: 1,
        },
      },
    });
  }

  async findVoucher(title: string) {
    const voucher = await this.prisma.discount.findFirst({
      where: {
        title: title,
        mode: 'coupon',
      },
      include: {
        entitleCategories: true,
        entitleProducts: true,
        entitleVariants: true,
      },
    });

    if (!voucher) return null;

    const formatData = {
      ...voucher,
      entitleCategories: voucher.entitleCategories.map(
        (item) => item.categoryId,
      ),

      entitleProducts: voucher.entitleProducts.map((item) => item.productId),
      entitleVariants: voucher.entitleVariants.map((item) => item.variantId),
    };

    return formatData;
  }

  async findVariantIdByCategoryId(categoryIds: number[]) {
    const variantIds = await this.prisma.productVariants.findMany({
      where: {
        product: {
          productCategories: {
            some: {
              categoryId: {
                in: categoryIds,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    const formatData = variantIds.map((item) => item.id);
    return formatData;
  }

  async checkVoucherValid(
    p: PrismaTransactionObject,
    order: OrderDetail,
    voucher: Voucher,
  ) {
    // Kiểm tra thời gian sử dụng
    if (
      voucher.startOn > new Date() ||
      (voucher.endOn && voucher.endOn < new Date())
    ) {
      throw new Error('Mã giảm giá không trong thời gian áp dụng');
    }

    // Kiểm tra đơn hàng đã dùng voucher này chưa
    const existVoucher = await p.orderApplyVoucher.findFirst({
      where: {
        discountId: voucher.id,
        orderId: order.id,
      },
    });

    if (existVoucher) throw new Error('Mã giảm giá đã được sử dụng');

    // Kiểm tra nếu voucher giới hạn sử dụng
    if (voucher.usageLimit && voucher.usage === voucher.usageLimit) {
      throw new Error('Mã giảm giá tới giới hạn sử dụng');
    }

    // Kiểm tra nếu voucher giới hạn mỗi khách hàng một lần
    if (voucher.onePerCustomer) {
      // Nếu là khách vãng lại sẽ không thể sử dụng
      if (order.userType === 'Guest') {
        throw new Error('Mã giảm giá chỉ áp dụng cho tài khoản thành viên');
      }

      // Nếu voucher này đã được khách hàng sử dụng
      const orderApplyVoucher = await p.orderApplyVoucher.findFirst({
        where: {
          discountId: voucher.id,
          order: {
            customerId: order.customerId,
          },
        },
      });
      if (orderApplyVoucher)
        throw new Error('Mã giảm giá này chỉ sử dụng 1 lần');
    }

    // Kiểm tra kết hợp giảm giá
    // Nếu không áp dụng với giảm giá đơn hàng khác
    if (!voucher.combinesWithOrderDiscount) {
      // Nếu đơn hàng đã áp dụng giảm giá đơn hàng -> Báo lỗi
      if (order.applyDiscounts.length > 0) {
        throw new Error(
          'Mã giảm giá không áp dụng chung với khuyến mại đơn hàng khác',
        );
      }
    }

    // Nếu không áp dụng với giảm giá sản phẩm khác
    if (!voucher.combinesWithProductDiscount) {
      // Nếu áp dụng cho tất cả sản phẩm -> Kiểm tra từng sản phẩm đã có khuyến mại nào chưa
      if (voucher.entitle === 'all') {
        // Danh sách sản phẩm đã áp dụng khuyến mại khác
        const applyDiscountItem = order.items.filter(
          (item) => item.applyDiscounts.length > 0,
        );

        if (applyDiscountItem.length > 0) {
          throw new Error(
            'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác',
          );
        }
      }

      if (voucher.entitle === 'entitledProduct') {
        for (const item of order.items) {
          // Nếu sản phẩm mà mã giảm giá áp dụng đã áp dụng khuyến mại khác
          if (
            item.applyDiscounts.length > 0 &&
            voucher.entitleVariants.includes(item.variantId)
          ) {
            throw new Error(
              "'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'",
            );
          }
        }
      }

      if (voucher.entitle === 'entitledCategory') {
        const entitledVariantIds = await this.findVariantIdByCategoryId(
          voucher.entitleCategories,
        );
        for (const item of order.items) {
          // Nếu sản phẩm mà mã giảm giá áp dụng đã áp dụng khuyến mại khác
          if (
            item.applyDiscounts.length > 0 &&
            entitledVariantIds.includes(item.variantId)
          ) {
            throw new Error(
              "'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'",
            );
          }
        }
      }
    }
  }

  async requestOrderList(params: QueryParams, res: Response) {
    try {
      const { orders, paginition } = await this.getOrderList(params);

      const formatOrderData: FormatOrder[] = orders.map((order) => {
        return {
          id: order.id,
          code: order.code,
          customer: order.customer,
          createdAt: order.createdAt,
          status: order.status,
          transactionStatus: order.transactionStatus,
          total: order.totalOrderAfterDiscount,
          customerId: order.customerId,
          phoneNumber: order.phoneNumber,
          name: order.name,
        };
      });

      const responseData: OrderListResponseData = {
        data: formatOrderData,
        paginition: paginition,
      };

      return res.status(200).json(responseData);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: 'Đã xảy ra lỗi',
      });
    }
  }

  async getOrderList(params: QueryParams) {
    const {
      page: pg,
      limit: lim,
      query,
      orderStatus,
      createdOn,
      createdOnMax,
      createdOnMin,
    } = params;
    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      void: false,
      code: {
        not: null,
      },
    };

    if (query) {
      where.OR = [
        {
          name: {
            startsWith: query,
          },
        },
        {
          phoneNumber: {
            startsWith: query,
          },
        },
        {
          code: {
            startsWith: query,
          },
        },
      ];
    }

    if (orderStatus) {
      where.status = orderStatus;
    }

    if (createdOn || createdOnMin || createdOnMax) {
      const { startDate, endDate } = tranformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax,
      );
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput = {
      createdAt: 'desc',
    };

    const orders = await this.prisma.order.findMany({
      select: {
        id: true,
        code: true,
        userType: true,
        customerId: true,
        phoneNumber: true,
        name: true,
        totalOrderAfterDiscount: true,
        status: true,
        transactionStatus: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      where: where,
      orderBy: orderBy,
      take: limit,
      skip: skip,
    });

    const countOrders = await this.prisma.order.count({
      where: where,
    });

    const totalPage = Math.floor(
      countOrders / limit < 1 ? 1 : countOrders / limit,
    );

    return {
      orders,
      paginition: {
        count: countOrders,
        page: page,
        limit: limit,
        total: totalPage,
      },
    };
  }

  async requestOrderDetail(orderId: string, res: Response) {
    try {
      const order = await this.getOrderDetail(orderId);

      const formatOrderData: FormatOrderDetail = {
        id: order.id,
        void: order.void,
        code: order.code,
        createdAt: order.createdAt,
        totalItemBeforeDiscount: order.totalItemBeforeDiscount,
        totalItemAfterDiscount: order.totalItemAfterDiscount,
        totalItemDiscountAmount: order.totalItemDiscountAmount,
        totalOrderDiscountAmount: order.totalOrderDiscountAmount,
        totalOrderBeforeDiscount: order.totalOrderBeforeDiscount,
        totalOrderAfterDiscount: order.totalOrderAfterDiscount,
        userType: order.userType,
        status: order.status,
        transactionStatus: order.transactionStatus,
        paymentMethod: order.paymentMethod,
        email: order.email,
        name: order.name,
        phoneNumber: order.phoneNumber,
        province: order.province,
        district: order.district,
        ward: order.ward,
        address: order.address,
        note: order.note,
        receiverName: order.receiverName,
        receiverPhoneNumber: order.receiverPhoneNumber,
        items: order.items.map((item) => ({
          ...item,
          applyDiscounts: item.applyDiscounts.map((item) => ({
            id: item.discount.id,
            title: item.discount.title,
            description: item.discount.description,
            discountAmount: item.discountAmount,
          })),
        })),
        applyDiscounts: order.applyDiscounts.map((item) => ({
          id: item.id,
          title: item.discount.title,
          description: item.discount.description,
          discountAmount: item.discountAmount,
        })),
        histories: order.history,
        customer: order.customer,
      };

      return res.status(200).json(formatOrderData);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: 'Đã xảy ra lỗi',
      });
    }
  }

  async confirmDelivery(
    orderId: string,
    isSendEmail: boolean,
    req,
    res: Response,
  ) {
    try {
      await this.prisma.$transaction(async (p) => {
        const { transactionStatus } = await p.order.findUnique({
          where: {
            id: orderId,
          },
          select: {
            transactionStatus: true,
          },
        });

        const order = await p.order.update({
          where: {
            id: orderId,
          },
          data: {
            status:
              transactionStatus === OrderTransactionStatus.PAID
                ? OrderStatus.COMPLETE
                : OrderStatus.IN_TRANSIT,
            history: {
              create: {
                action: OrderHistoryAction.CONFIRM_SHIPPING,
                type: OrderHistoryType.ADJUSTMENT,
                changedUserId: req.user.id,
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
                product: {
                  select: {
                    name: true,
                  },
                },
                priceAfterDiscount: true,
                quantity: true,
                totalPriceAfterDiscount: true,
                sources: true,
                variantId: true,
              },
            },
          },
        });

        // Cập nhật tồn kho (Do đã chuyển hàng khỏi kho)
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
                onHand: { decrement: source.quantity },
                histories: {
                  create: {
                    transactionAction: InventoryTransactionAction.DELIVERY,
                    transactionType: InventoryTransactionType.ORDER,
                    onHandQuantityChange: source.quantity * -1,
                    newOnHand: inventory.onHand * source.quantity,
                    changeUserId: req.user.id,
                    orderId: orderId,
                  },
                },
              },
            });
          }
        }

        if (isSendEmail) {
          this.mailService.sendUserDeliveryConfirmNotification(order);
        }
      });

      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: error.message });
    }
  }

  async cancelOrderByAdmin(
    dto: {
      orderId: string;
      isReStock: boolean;
      reason: string;
    },
    req,
    res: Response,
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
                  reason: reason,
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
        },
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
    res: Response,
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
        { maxWait: 20000, timeout: 20000 },
      );
      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json(error.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại');
    }
  }

  async deleteOrder(orderId: string, req, res: Response) {
    try {
      await this.prisma.order.update({
        where: {
          id: orderId,
        },
        data: {
          void: true,
          history: {
            create: {
              action: OrderHistoryAction.DELETE,
              type: OrderHistoryType.ADJUSTMENT,
              changedUserId: req.user.id,
            },
          },
        },
      });
      return res.status(200).json({ message: 'Đã xóa đơn hàng' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json(error.message ?? 'Đã có lỗi xảy ra. Vui lòng thử lại');
    }
  }

  private sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
  }

  async VNPAY_RETURN(req, res: Response) {
    console.log('>>> Request query', req.query);
    // let vnp_Params = req.query;

    // let secureHash = vnp_Params['vnp_SecureHash'];

    // delete vnp_Params['vnp_SecureHash'];
    // delete vnp_Params['vnp_SecureHashType'];

    // vnp_Params = this.sortObject(vnp_Params);

    // let config = require('config');
    // let tmnCode = config.get('vnp_TmnCode');
    // let secretKey = config.get('vnp_HashSecret');

    // let querystring = require('qs');
    // let signData = querystring.stringify(vnp_Params, { encode: false });
    // let crypto = require('crypto');
    // let hmac = crypto.createHmac('sha512', secretKey);
    // let signed = hmac.update(new Buffer(signData, 'utf-8')).digest('hex');

    // if (secureHash === signed) {
    //   //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua

    //   res.render('success', { code: vnp_Params['vnp_ResponseCode'] });
    // } else {
    //   res.render('success', { code: '97' });
    // }
    return res.status(200).json(req.query);
  }
}
