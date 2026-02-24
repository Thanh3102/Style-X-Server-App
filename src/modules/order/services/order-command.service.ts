import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderQueryService } from '../services/order-query.service';
import { DiscountService } from 'src/modules/discount/discount.service';
import { PrismaTransactionObject } from 'src/prisma/prisma.types';
import {
  FormatOrderDetail,
  OrderDetail,
  OrderHistoryAction,
  OrderHistoryType,
  OrderStatus,
  OrderTransactionStatus,
} from '../order.type';
import { Voucher } from 'src/modules/discount/discount.type';
import { ProductQueryService } from 'src/modules/product/services/product-query.service';
import { Response } from 'express';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';
import { MailService } from 'src/modules/mail/mail.service';

@Injectable()
export class OrderCommandService {
  constructor(
    private prisma: PrismaService,
    private orderQueryService: OrderQueryService,
    private discountService: DiscountService,
    private productQueryService: ProductQueryService,
    private mailService: MailService
  ) {}

  async checkVoucherCondition(
    p: PrismaTransactionObject,
    order: OrderDetail,
    voucher: Voucher
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
          'Mã giảm giá không áp dụng chung với khuyến mại đơn hàng khác'
        );
      }
    }

    // Nếu không áp dụng với giảm giá sản phẩm khác
    if (!voucher.combinesWithProductDiscount) {
      // Nếu áp dụng cho tất cả sản phẩm -> Kiểm tra từng sản phẩm đã có khuyến mại nào chưa
      if (voucher.entitle === 'all') {
        // Danh sách sản phẩm đã áp dụng khuyến mại khác
        const applyDiscountItem = order.items.filter(
          (item) => item.applyDiscounts.length > 0
        );

        if (applyDiscountItem.length > 0) {
          throw new Error(
            'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'
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
              "'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'"
            );
          }
        }
      }

      if (voucher.entitle === 'entitledCategory') {
        const entitledVariantIds =
          await this.productQueryService.findVariantIdByCategoryId(
            voucher.entitleCategories
          );
        for (const item of order.items) {
          // Nếu sản phẩm mà mã giảm giá áp dụng đã áp dụng khuyến mại khác
          if (
            item.applyDiscounts.length > 0 &&
            entitledVariantIds.includes(item.variantId)
          ) {
            throw new Error(
              "'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'"
            );
          }
        }
      }
    }

    return true;
  }

  async handleApplyProductVoucher(
    p: PrismaTransactionObject,
    order: OrderDetail,
    voucher: Voucher
  ) {
    let applyItems: OrderDetail['items'][number][] = [];

    switch (voucher.entitle) {
      case 'all':
        applyItems = order.items;
        break;

      case 'entitledProduct':
        applyItems = order.items.filter((item) =>
          voucher.entitleVariants.includes(item.variantId)
        );
        break;
      case 'entitledCategory':
        const applyVariantIds =
          await this.productQueryService.findVariantIdByCategoryId(
            voucher.entitleCategories
          );

        applyItems = order.items.filter((item) =>
          applyVariantIds.includes(item.variantId)
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
            `Tổng số lượng sản phẩm khuyến mại phải lớn hơn ${voucher.prerequisiteMinItem}`
          );
        break;

      case 'prerequisiteMinItemTotal':
        let totalItemsPrice = 0;
        for (const item of applyItems) {
          totalItemsPrice += item.totalPriceBeforeDiscount;
        }
        if (totalItemsPrice < voucher.prerequisiteMinItemTotal)
          throw new Error(
            `Tổng giá trị sản phẩm khuyến mại phải lớn hơn ${voucher.prerequisiteMinItemTotal} VNĐ`
          );
        break;

      case 'prerequisiteMinTotal':
        if (order.totalOrderBeforeDiscount < voucher.prerequisiteMinTotal)
          throw new Error(
            `Tổng giá trị đơn hàng phải lớn hơn ${voucher.prerequisiteMinTotal} VNĐ`
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
        (promo) => promo.combineWithOrderDiscount
      );

      const canCombineValueDiscount = canCombineOrderPromotion.filter(
        (promo) => promo.valueType === 'value'
      );

      const canCombinePercentDiscount = canCombineOrderPromotion.filter(
        (promo) => promo.valueType === 'percent'
      );

      const cannotCombineOrderPromotion = activeOrderPromotions.filter(
        (promo) => !promo.combineWithOrderDiscount
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
    voucher: Voucher
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
            `Tổng số lượng sản phẩm trong đơn phải lớn hơn ${voucher.prerequisiteMinItem}`
          );
        break;

      case 'prerequisiteMinTotal':
        if (order.totalOrderBeforeDiscount < voucher.prerequisiteMinTotal)
          throw new Error(
            `Tổng giá trị đơn hàng phải lớn hơn ${voucher.prerequisiteMinTotal} VNĐ`
          );
        break;
    }

    // Tính lại thông tin đơn hàng
    let discountValue = 0;
    switch (voucher.valueType) {
      case 'percent':
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
      case 'value':
        discountValue = voucher.value;
        break;
    }

    let newTotalOrderAfterDiscount =
      order.totalOrderAfterDiscount - discountValue;
    let newTotalOrderDiscountAmount =
      order.totalOrderDiscountAmount + discountValue;

    console.log('discount amount', discountValue);

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

  async applyVoucher(orderId: string, voucherCode: string, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const orderDetail =
            await this.orderQueryService.getOrderDetail(orderId);
          const voucher = await this.discountService.findVoucher(voucherCode);

          if (!voucher) throw new Error('Mã giảm giá không tồn tại');

          // Kiểm tra có thể sử dụng voucher
          await this.checkVoucherCondition(p, orderDetail, voucher);

          console.log('Voucher', voucher);

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
        }
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

  async confirmDelivery(
    orderId: string,
    isSendEmail: boolean,
    req,
    res: Response
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

  async requestOrderDetail(orderId: string, res: Response) {
    try {
      const order = await this.orderQueryService.getOrderDetail(orderId);

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
}
