import { Injectable } from '@nestjs/common';
import { CartItem } from '../order.type';
import { DiscountService } from 'src/modules/discount/discount.service';

@Injectable()
export class OrderCalculationService {
  constructor(private discountService: DiscountService) {}

  async calculateItem(item: CartItem, totalPriceBeforeDiscount: number) {
    // Giá trước khi giảm giá
    // Tính toán giá sản phẩm sau khuyến mại
    const activeProductPromotions =
      await this.discountService.getActiveDiscounts({
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
      (item) => !item.combinesWithProductDiscount
    );
    // Danh sách các khuyến mại có thể kết hợp
    const combinePromotions = affectedPromotions.filter(
      (item) => item.combinesWithProductDiscount
    );

    // Lọc các khuyến mại có thể kết hợp theo loại
    const combineValuePromotions = combinePromotions.filter(
      (item) => item.valueType === 'value'
    );
    const combinePercentPromotions = combinePromotions.filter(
      (item) => item.valueType === 'percent'
    );
    const combineFlatPromotions = combinePromotions.filter(
      (item) => item.valueType === 'flat'
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
              item.variant.sellPrice * promotion.value * 0.01
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
          100
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
}
