import { Injectable } from '@nestjs/common';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { ProductQueryService } from 'src/modules/product/services/product-query.service';
import { Voucher } from 'src/modules/discount/discount.type';
import { OrderDetail } from '../order.type';

@Injectable()
export class OrderVoucherPolicyService {
  constructor(private readonly productQueryService: ProductQueryService) {}

  async assertCanApply(
    transaction: PrismaTransactionClient,
    order: OrderDetail,
    voucher: Voucher
  ): Promise<true> {
    if (
      voucher.startOn > new Date() ||
      (voucher.endOn && voucher.endOn < new Date())
    ) {
      throw new Error('Mã giảm giá không trong thời gian áp dụng');
    }

    const existingVoucher = await transaction.orderApplyVoucher.findFirst({
      where: { discountId: voucher.id, orderId: order.id },
    });
    if (existingVoucher) throw new Error('Mã giảm giá đã được sử dụng');

    if (voucher.usageLimit && voucher.usage === voucher.usageLimit) {
      throw new Error('Mã giảm giá tới giới hạn sử dụng');
    }

    if (voucher.onePerCustomer) {
      if (order.userType === 'Guest') {
        throw new Error('Mã giảm giá chỉ áp dụng cho tài khoản thành viên');
      }
      const customerVoucher = await transaction.orderApplyVoucher.findFirst({
        where: {
          discountId: voucher.id,
          order: { customerId: order.customerId },
        },
      });
      if (customerVoucher) throw new Error('Mã giảm giá này chỉ sử dụng 1 lần');
    }

    if (!voucher.combinesWithOrderDiscount && order.applyDiscounts.length > 0) {
      throw new Error(
        'Mã giảm giá không áp dụng chung với khuyến mại đơn hàng khác'
      );
    }

    if (!voucher.combinesWithProductDiscount) {
      if (voucher.entitle === 'all') {
        if (order.items.some((item) => item.applyDiscounts.length > 0)) {
          throw new Error(
            'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'
          );
        }
      }

      if (voucher.entitle === 'entitledProduct') {
        if (
          order.items.some(
            (item) =>
              item.applyDiscounts.length > 0 &&
              voucher.entitleVariants.includes(item.variantId)
          )
        ) {
          throw new Error(
            "'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'"
          );
        }
      }

      if (voucher.entitle === 'entitledCategory') {
        const variantIds =
          await this.productQueryService.findVariantIdByCategoryId(
            voucher.entitleCategories
          );
        if (
          order.items.some(
            (item) =>
              item.applyDiscounts.length > 0 &&
              variantIds.includes(item.variantId)
          )
        ) {
          throw new Error(
            "'Mã giảm giá không áp dụng chung với khuyến mại sản phẩm khác'"
          );
        }
      }
    }

    return true;
  }
}
