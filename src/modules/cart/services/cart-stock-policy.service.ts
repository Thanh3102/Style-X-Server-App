import { Injectable } from '@nestjs/common';
import { ProductInventoryService } from '../../product/services/product-inventory.service';

@Injectable()
export class CartStockPolicy {
  constructor(private readonly inventoryService: ProductInventoryService) {}

  async getAvailable(variantId: number): Promise<number> {
    const { avaiable } =
      await this.inventoryService.getVariantInventoryStock(variantId);
    return avaiable ?? 0;
  }

  async isQuantityUnavailable(
    variantId: number,
    quantity: number
  ): Promise<boolean> {
    return quantity > (await this.getAvailable(variantId));
  }
}
