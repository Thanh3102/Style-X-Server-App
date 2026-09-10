import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import type { CartItemData } from '../../cart/cart.type';
import type { ActiveDiscount } from '../discount.type';
import { DiscountQueryService } from './discount-query.service';

export type AppliedDiscount = ActiveDiscount & { amount: number };

export type VariantDiscountResult = {
  discountPrice: number | null;
  discountPercent: number | null;
  applyPromotions: AppliedDiscount[];
  activePromotions: ActiveDiscount[];
};

export type ItemDiscountResult = {
  discountPrice: number | null;
  discountPercent: number | null;
  discountAmount: number;
  applyPromotions: AppliedDiscount[];
};

export type DiscountedCartItem = CartItemData & {
  applyPromotions: AppliedDiscount[];
  discountPrice: number;
  discountPercent: number;
  discountAmount: number;
  totalDiscount: number;
  totalPrice: number;
};

export type DiscountOrderResult = {
  finalItems: DiscountedCartItem[];
  applyOrderPromotions: AppliedDiscount[];
  totalItemBeforeDiscount: number;
  totalItemAfterDiscount: number;
  totalItemDiscountAmount: number;
  totalOrderBeforeDiscount: number;
  totalOrderAfterDiscount: number;
  totalOrderDiscountAmount: number;
};

@Injectable()
export class DiscountCalculationService {
  private readonly logger = new Logger(DiscountCalculationService.name);

  constructor(private readonly queryService: DiscountQueryService) {}

  async calcVariantDiscount(
    variant: { sellPrice: number; id: number },
    activeProductPromotions: ActiveDiscount[],
    _options?: { withPrerequire?: boolean }
  ): Promise<VariantDiscountResult> {
    try {
      const nonePrerequirePromotions = activeProductPromotions.filter(
        (promotion) => {
          if (promotion.prerequisite === 'none') {
            if (promotion.entitle === 'all') return true;
            if (promotion.variantIds.includes(variant.id)) return true;
          }
          return false;
        }
      );

      const affectedPromotions = activeProductPromotions.filter((promotion) => {
        if (promotion.entitle === 'all') return true;
        if (promotion.variantIds.includes(variant.id)) return true;
        return false;
      });

      const applyPromotions: AppliedDiscount[] = [];
      let priceRemain = variant.sellPrice;
      let discountAmount = 0;
      const notCombinePromotions = nonePrerequirePromotions.filter(
        (item) => !item.combinesWithProductDiscount
      );
      const combinePromotions = nonePrerequirePromotions.filter(
        (item) => item.combinesWithProductDiscount
      );

      const combineValuePromotions = combinePromotions.filter(
        (item) => item.valueType === 'value'
      );
      const combinePercentPromotions = combinePromotions.filter(
        (item) => item.valueType === 'percent'
      );
      const combineFlatPromotions = combinePromotions.filter(
        (item) => item.valueType === 'flat'
      );

      if (notCombinePromotions.length > 0) {
        let maxNotCombineDiscountValue = 0;
        let applyPromotion: ActiveDiscount | null = null;
        for (const promotion of notCombinePromotions) {
          switch (promotion.valueType) {
            case 'flat': {
              const flatDiscountValue =
                promotion.value < variant.sellPrice ? promotion.value : null;
              if (
                flatDiscountValue &&
                flatDiscountValue > maxNotCombineDiscountValue
              ) {
                maxNotCombineDiscountValue = flatDiscountValue;
                applyPromotion = promotion;
              }
              break;
            }
            case 'percent': {
              let percentDiscountValue = Math.round(
                variant.sellPrice * promotion.value * 0.01
              );
              if (promotion.valueLimitAmount) {
                percentDiscountValue =
                  percentDiscountValue <= promotion.valueLimitAmount
                    ? percentDiscountValue
                    : promotion.valueLimitAmount;
              }
              if (percentDiscountValue > maxNotCombineDiscountValue) {
                maxNotCombineDiscountValue = percentDiscountValue;
                applyPromotion = promotion;
              }
              break;
            }
            case 'value': {
              const valueDiscountValue =
                variant.sellPrice - promotion.value >= 0
                  ? variant.sellPrice - promotion.value
                  : 0;
              if (valueDiscountValue > maxNotCombineDiscountValue) {
                maxNotCombineDiscountValue = valueDiscountValue;
                applyPromotion = promotion;
              }
              break;
            }
          }
        }
        priceRemain -= maxNotCombineDiscountValue;
        discountAmount += maxNotCombineDiscountValue;
        if (applyPromotion) {
          applyPromotions.push({
            ...applyPromotion,
            amount: maxNotCombineDiscountValue,
          });
        }
      }

      if (combinePromotions.length > 0) {
        const minFlatPromotion = combineFlatPromotions.reduce(
          (min, current) => {
            if (min) {
              return current.value < min.value ? current : min;
            }
            return current;
          },
          null
        );

        if (minFlatPromotion && minFlatPromotion.value < priceRemain) {
          priceRemain = minFlatPromotion.value;
          discountAmount += minFlatPromotion.value;
          applyPromotions.push({
            ...minFlatPromotion,
            amount: minFlatPromotion.value,
          });
        }

        for (const promotion of combinePercentPromotions) {
          let amount = priceRemain * promotion.value * 0.01;
          if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
            amount = promotion.valueLimitAmount;
          priceRemain -= amount;
          discountAmount += amount;
          applyPromotions.push({ ...promotion, amount });
        }

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
      let discountPrice = null;
      let discountPercent = null;
      if (discountAmount !== 0) {
        discountPrice = variant.sellPrice - discountAmount;
        discountPercent = Math.floor(
          ((variant.sellPrice - discountPrice) / variant.sellPrice) * 100
        );
      }

      return {
        discountPrice,
        discountPercent,
        applyPromotions,
        activePromotions: affectedPromotions,
      };
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      return undefined;
    }
  }

  async calcOrderDiscount(items: CartItemData[]): Promise<DiscountOrderResult> {
    const activePromotions = await this.queryService.getActiveDiscounts({
      mode: ['promotion'],
      type: ['product'],
    });

    const calcItemsDiscountPromise = items.map(async (item) => {
      const {
        applyPromotions,
        discountAmount,
        discountPercent,
        discountPrice,
      } = await this.calcItemDiscount(item, activePromotions);
      return {
        ...item,
        applyPromotions,
        discountPrice,
        discountPercent,
        discountAmount: discountAmount * item.quantity,
        totalDiscount: discountPrice * item.quantity,
        totalPrice: item.variant.sellPrice * item.quantity,
      };
    });

    const itemsAfterDiscount = await Promise.all(calcItemsDiscountPromise);
    const selectedItems = itemsAfterDiscount.filter((item) => item.selected);

    const totalItemBeforeDiscount = selectedItems.reduce(
      (total, item) => total + item.quantity * item.variant.sellPrice,
      0
    );

    const totalItemAfterDiscount = selectedItems
      .filter((item) => items.find((i) => i.id === item.id))
      .reduce((total, item) => {
        if (item.totalDiscount) {
          return total + item.totalDiscount;
        }
        return total + item.totalPrice;
      }, 0);
    const totalItemDiscountAmount = selectedItems
      .filter((item) => items.find((i) => i.id === item.id))
      .reduce((total, item) => total + item.discountAmount, 0);

    const totalOrderBeforeDiscount = totalItemAfterDiscount;
    let totalOrderRemain = totalOrderBeforeDiscount;

    const activeOrderPromotions = await this.queryService.getActiveDiscounts({
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
              return totalItemAfterDiscount >= promotion.prerequisiteMinTotal;

            if (!promotion.combinesWithProductDiscount)
              return totalItemAfterDiscount >= promotion.prerequisiteMinTotal;
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
    const applyOrderPromotions: AppliedDiscount[] = [];

    if (cannotCombineOrderPromotion.length > 0) {
      let maxNonCombineDiscountAmount = -1;
      let discountValue = 0;
      let applyPromotion: ActiveDiscount | null = null;
      for (const promotion of cannotCombineOrderPromotion) {
        switch (promotion.valueType) {
          case 'percent': {
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
          }
          case 'value': {
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
      }

      totalOrderRemain -= maxNonCombineDiscountAmount;
      totalOrderDiscountAmount += maxNonCombineDiscountAmount;
      if (applyPromotion) {
        applyOrderPromotions.push({
          ...applyPromotion,
          amount: discountValue,
        });
      }
    }

    if (canCombineOrderPromotion.length > 0) {
      for (const promotion of canCombinePercentDiscount) {
        let amount = totalOrderRemain * promotion.value * 0.01;
        if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
          amount = promotion.valueLimitAmount;
        totalOrderRemain -= amount;
        totalOrderDiscountAmount += amount;
        applyOrderPromotions.push({ ...promotion, amount });
      }

      for (const promotion of canCombineValueDiscount) {
        if (totalOrderRemain > 0) {
          const newtotalOrderRemain = totalOrderRemain - promotion.value;
          const discountedAmount =
            newtotalOrderRemain > 0 ? promotion.value : totalOrderRemain;
          totalOrderRemain = newtotalOrderRemain >= 0 ? newtotalOrderRemain : 0;
          totalOrderDiscountAmount += discountedAmount;
          applyOrderPromotions.push({
            ...promotion,
            amount: discountedAmount,
          });
        }
      }
    }

    const totalOrderAfterDiscount = totalOrderRemain;

    return {
      finalItems: itemsAfterDiscount,
      applyOrderPromotions,
      totalItemBeforeDiscount,
      totalItemAfterDiscount,
      totalItemDiscountAmount,
      totalOrderBeforeDiscount,
      totalOrderAfterDiscount,
      totalOrderDiscountAmount,
    };
  }

  async calcItemDiscount(
    item: CartItemData,
    activeProductPromotions: ActiveDiscount[]
  ): Promise<ItemDiscountResult> {
    try {
      const totalPriceBeforeDiscount = item.variant.sellPrice * item.quantity;

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

            case 'prerequisiteMinItemTotal': {
              const totalItemBeforeDiscount =
                item.variant.sellPrice * item.quantity;
              if (totalItemBeforeDiscount < promotion.prerequisiteMinItemTotal)
                return false;
              break;
            }

            case 'prerequisiteMinItem':
              if (item.quantity < promotion.prerequisiteMinItem) return false;
              break;
          }
        }
        return true;
      });

      const applyPromotions: AppliedDiscount[] = [];
      let priceRemain = item.variant.sellPrice;
      let discountAmount = 0;
      const notCombinePromotions = affectedPromotions.filter(
        (item) => !item.combinesWithProductDiscount
      );
      const combinePromotions = affectedPromotions.filter(
        (item) => item.combinesWithProductDiscount
      );

      const combineValuePromotions = combinePromotions.filter(
        (item) => item.valueType === 'value'
      );
      const combinePercentPromotions = combinePromotions.filter(
        (item) => item.valueType === 'percent'
      );
      const combineFlatPromotions = combinePromotions.filter(
        (item) => item.valueType === 'flat'
      );

      if (notCombinePromotions.length > 0) {
        let maxNotCombineDiscountValue = 0;
        let applyPromotion: ActiveDiscount | null = null;
        for (const promotion of notCombinePromotions) {
          switch (promotion.valueType) {
            case 'flat': {
              const flatDiscountValue =
                promotion.value < item.variant.sellPrice
                  ? promotion.value
                  : null;
              if (
                flatDiscountValue &&
                flatDiscountValue > maxNotCombineDiscountValue
              ) {
                maxNotCombineDiscountValue = flatDiscountValue;
                applyPromotion = promotion;
              }
              break;
            }
            case 'percent': {
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
                maxNotCombineDiscountValue = percentDiscountValue;
                applyPromotion = promotion;
              }
              break;
            }
            case 'value': {
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
        }
        priceRemain -= maxNotCombineDiscountValue;
        discountAmount += maxNotCombineDiscountValue;
        if (applyPromotion) {
          applyPromotions.push({
            ...applyPromotion,
            amount: maxNotCombineDiscountValue,
          });
        }
      }

      if (combinePromotions.length > 0) {
        const minFlatPromotion = combineFlatPromotions.reduce(
          (min, current) => {
            if (min) {
              return current.value < min.value ? current : min;
            }
            return current;
          },
          null
        );

        if (minFlatPromotion && minFlatPromotion.value < priceRemain) {
          priceRemain = minFlatPromotion.value;
          discountAmount += minFlatPromotion.value;
          applyPromotions.push({
            ...minFlatPromotion,
            amount: minFlatPromotion.value,
          });
        }

        for (const promotion of combinePercentPromotions) {
          let amount = priceRemain * promotion.value * 0.01;
          if (promotion.valueLimitAmount && amount > promotion.valueLimitAmount)
            amount = promotion.valueLimitAmount;
          priceRemain -= amount;
          discountAmount += amount;
          applyPromotions.push({ ...promotion, amount });
        }

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
      let discountPrice = null;
      let discountPercent = null;
      if (discountAmount !== 0) {
        discountPrice = item.variant.sellPrice - discountAmount;
        discountPercent = Math.floor(
          ((item.variant.sellPrice - discountPrice) / item.variant.sellPrice) *
            100
        );
      }

      return {
        discountPrice,
        discountPercent,
        discountAmount,
        applyPromotions,
      };
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      return undefined;
    }
  }
}
