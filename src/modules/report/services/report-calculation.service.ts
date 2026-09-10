import { Injectable } from '@nestjs/common';

type ReportOrderItem = {
  quantity?: number;
  sources: Array<{
    quantity: number;
    costPrice: number;
  }>;
};

type ReportInventoryVariant = {
  costPrice: number;
  receiveItems: Array<{
    finalPrice: number;
    quantityAvaiable: number;
  }>;
  inventories: Array<{
    avaiable: number;
  }>;
};

export type ReportOrderItemCost = {
  quantity: number;
  cost: number;
};

@Injectable()
export class ReportCalculationService {
  orderItemCost(items: ReportOrderItem[]): ReportOrderItemCost {
    return items.reduce(
      (total, item) => {
        const cost = item.sources.reduce(
          (itemTotal, source) => itemTotal + source.quantity * source.costPrice,
          0
        );

        return {
          quantity: total.quantity + (item.quantity ?? 0),
          cost: total.cost + cost,
        };
      },
      { quantity: 0, cost: 0 }
    );
  }

  inventoryValue(variants: ReportInventoryVariant[]): number {
    return variants.reduce((total, item) => {
      let totalReceive = 0;
      let inventoryQuantityLeft = item.inventories.reduce(
        (inventoryTotal, inventory) => inventoryTotal + inventory.avaiable,
        0
      );

      for (const receive of item.receiveItems) {
        totalReceive += receive.finalPrice * receive.quantityAvaiable;
        inventoryQuantityLeft -= receive.quantityAvaiable;
      }

      return total + totalReceive + inventoryQuantityLeft * item.costPrice;
    }, 0);
  }
}
