import { ReportSorterService } from './report-sorter.service';
import { ReportMapperService } from './report-mapper.service';

describe('ReportMapperService', () => {
  it('maps overview metrics without changing the public field names', () => {
    const service = new ReportMapperService(new ReportSorterService());

    expect(
      service.overview({
        grossProfit: 500,
        inventoryValue: 54,
        totalCostPrice: 24,
        numberOfOrders: 2,
      })
    ).toEqual({
      grossProfit: 500,
      inventoryValue: 54,
      netRevenue: 476,
      numberOfOrders: 2,
    });
  });

  it('maps a low-stock variant and excludes variants at the threshold', () => {
    const service = new ReportMapperService(new ReportSorterService());

    expect(
      service.lowStock([
        {
          id: 1,
          title: 'M',
          skuCode: 'SKU-1',
          barCode: 'BAR-1',
          product: {
            id: 10,
            name: 'Tee',
            vendor: 'Vendor',
            type: 'Shirt',
          },
          inventories: [
            { id: 1, onHand: 5, warehouse: { id: 1, name: 'Main' } },
            { id: 2, onHand: 10, warehouse: { id: 2, name: 'Backup' } },
          ],
        },
        {
          id: 2,
          title: 'L',
          skuCode: 'SKU-2',
          barCode: 'BAR-2',
          product: {
            id: 10,
            name: 'Tee',
            vendor: 'Vendor',
            type: 'Shirt',
          },
          inventories: [
            { id: 3, onHand: 30, warehouse: { id: 1, name: 'Main' } },
          ],
        },
      ])
    ).toEqual([
      {
        onHand: 15,
        product: { id: 10, name: 'Tee', type: 'Shirt', vendor: 'Vendor' },
        variant: {
          id: 1,
          barCode: 'BAR-1',
          skuCode: 'SKU-1',
          title: 'M',
        },
        warehouses: [
          { id: 1, name: 'Main', onHand: 5 },
          { id: 2, name: 'Backup', onHand: 10 },
        ],
      },
    ]);
  });
});
