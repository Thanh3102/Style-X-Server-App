import { ProductInventoryService } from '../../product/services/product-inventory.service';
import { CartStockPolicy } from './cart-stock-policy.service';

describe('CartStockPolicy', () => {
  it('reports when requested quantity exceeds available stock', async () => {
    const inventoryService = {
      getVariantInventoryStock: jest.fn().mockResolvedValue({ avaiable: 3 }),
    } as unknown as ProductInventoryService;
    const service = new CartStockPolicy(inventoryService);

    await expect(service.isQuantityUnavailable(10, 4)).resolves.toBe(true);
    await expect(service.isQuantityUnavailable(10, 3)).resolves.toBe(false);
  });
});
