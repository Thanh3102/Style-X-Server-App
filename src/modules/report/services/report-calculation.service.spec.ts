import { ReportCalculationService } from './report-calculation.service';

describe('ReportCalculationService', () => {
  it('calculates order-item quantity and cost from allocation sources', () => {
    const service = new ReportCalculationService();

    expect(
      service.orderItemCost([
        {
          quantity: 3,
          sources: [
            { quantity: 2, costPrice: 10 },
            { quantity: 1, costPrice: 20 },
          ],
        },
        { quantity: 1, sources: [{ quantity: 1, costPrice: 5 }] },
      ])
    ).toEqual({ quantity: 4, cost: 45 });
  });

  it('values receive lots and remaining inventory using the original cost rule', () => {
    const service = new ReportCalculationService();

    expect(
      service.inventoryValue([
        {
          costPrice: 10,
          receiveItems: [{ finalPrice: 12, quantityAvaiable: 2 }],
          inventories: [{ avaiable: 5 }],
        },
      ])
    ).toBe(54);
  });
});
