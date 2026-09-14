import { Injectable } from '@nestjs/common';
import { DiscountService } from 'src/modules/discount/discount.service';
import { Voucher } from 'src/modules/discount/discount.type';
import { ProductQueryService } from 'src/modules/product/services/product-query.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { OrderDetail } from '../order.type';
import { OrderQueryService } from './order-query.service';
import { OrderVoucherPolicyService } from './order-voucher-policy.service';

@Injectable()
export class OrderVoucherApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderQueryService: OrderQueryService,
    private readonly discountService: DiscountService,
    private readonly productQueryService: ProductQueryService,
    private readonly voucherPolicy: OrderVoucherPolicyService
  ) {}

  async apply(orderId: string, voucherCode: string): Promise<void> {
    await this.prisma.$transaction(
      async (p) => {
        const orderDetail =
          await this.orderQueryService.getOrderDetail(orderId);
        const voucher = await this.discountService.findVoucher(voucherCode);

        if (!voucher) throw new Error('Mã giảm giá không tồn tại');

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
  }

  private async handleApplyProductVoucher(
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

    let totalVoucherItemDiscountAmount = 0;

    for (const item of applyItems) {
      let newPriceAfterDiscount = item.priceAfterDiscount;
      let discountAmount = 0;
      switch (voucher.valueType) {
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

    if (order.applyDiscounts.length > 0) {
      const totalItemAfterDiscount =
        order.totalItemAfterDiscount - totalVoucherItemDiscountAmount;
      let totalOrderRemain = totalItemAfterDiscount;

      const activeOrderPromotions = order.applyDiscounts;

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

        totalOrderRemain -= maxNonCombineDiscountAmount;
        totalOrderDiscountAmount += maxNonCombineDiscountAmount;
      }

      if (canCombineOrderPromotion.length > 0) {
        for (const promotion of canCombinePercentDiscount) {
          let amount = totalOrderRemain * promotion.value * 0.01;
          if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
            amount = promotion.valueLimitAmount;

          totalOrderRemain -= amount;
          totalOrderDiscountAmount += amount;
        }

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

    await p.orderApplyVoucher.create({
      data: {
        discountId: voucher.id,
        orderId: order.id,
      },
    });

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

  private async handleApplyOrderVoucher(
    p: PrismaTransactionClient,
    order: OrderDetail,
    voucher: Voucher
  ) {
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

    await p.order.update({
      where: {
        id: order.id,
      },
      data: {
        totalOrderAfterDiscount: newTotalOrderAfterDiscount,
        totalOrderDiscountAmount: newTotalOrderDiscountAmount,
      },
    });

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

    await p.orderApplyVoucher.create({
      data: {
        discountId: voucher.id,
        orderId: order.id,
      },
    });

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
}
