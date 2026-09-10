import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderQueryService } from '../services/order-query.service';
import { DiscountService } from 'src/modules/discount/discount.service';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { OrderDetail } from '../order.type';
import { Voucher } from 'src/modules/discount/discount.type';
import { ProductQueryService } from 'src/modules/product/services/product-query.service';
import { Response } from 'express';
import { OrderCancellationService } from './order-cancellation.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderResponseMapper } from './order-response-mapper.service';
import { OrderVoucherPolicyService } from './order-voucher-policy.service';

@Injectable()
export class OrderCommandService {
  private readonly logger = new Logger(OrderCommandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderQueryService: OrderQueryService,
    private readonly discountService: DiscountService,
    private readonly productQueryService: ProductQueryService,
    private readonly voucherPolicy: OrderVoucherPolicyService,
    private readonly cancellationService: OrderCancellationService,
    private readonly fulfillmentService: OrderFulfillmentService,
    private readonly responseMapper: OrderResponseMapper
  ) {}

  async checkVoucherCondition(
    p: PrismaTransactionClient,
    order: OrderDetail,
    voucher: Voucher
  ): Promise<true> {
    return this.voucherPolicy.assertCanApply(p, order, voucher);
  }

  async handleApplyProductVoucher(
    p: PrismaTransactionClient,
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
              }
              break;
            case 'value':
              const valueDiscountValue =
                totalItemAfterDiscount - promotion.value >= 0
                  ? totalItemAfterDiscount - promotion.value
                  : 0;
              if (valueDiscountValue > maxNonCombineDiscountAmount) {
                maxNonCombineDiscountAmount = valueDiscountValue;
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
    p: PrismaTransactionClient,
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

    const newTotalOrderAfterDiscount =
      order.totalOrderAfterDiscount - discountValue;
    const newTotalOrderDiscountAmount =
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

  async applyVoucher(orderId: string, voucherCode: string, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          const orderDetail =
            await this.orderQueryService.getOrderDetail(orderId);
          const voucher = await this.discountService.findVoucher(voucherCode);

          if (!voucher) throw new Error('Mã giảm giá không tồn tại');

          // Kiểm tra có thể sử dụng voucher
          await this.voucherPolicy.assertCanApply(p, orderDetail, voucher);

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
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async deleteOrder(orderId: string, req, res: Response) {
    try {
      await this.cancellationService.deleteOrder(orderId, Number(req.user.id));
      return res.status(200).json({ message: 'Đã xóa đơn hàng' });
    } catch (error: unknown) {
      this.logError(error);
      return res
        .status(500)
        .json(
          error instanceof Error
            ? error.message
            : 'Đã có lỗi xảy ra. Vui lòng thử lại'
        );
    }
  }

  async confirmDelivery(
    orderId: string,
    isSendEmail: boolean,
    req,
    res: Response
  ) {
    try {
      await this.fulfillmentService.confirmDelivery(
        orderId,
        isSendEmail,
        Number(req.user.id)
      );
      return res.status(200).json({ message: 'Đã cập nhật đơn hàng' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  async requestOrderDetail(orderId: string, res: Response) {
    try {
      const order = await this.orderQueryService.getOrderDetail(orderId);

      const formatOrderData = this.responseMapper.toDetailResponse(order);

      return res.status(200).json(formatOrderData);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: 'Đã xảy ra lỗi',
      });
    }
  }

  private logError(error: unknown): void {
    this.logger.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
  }
}
