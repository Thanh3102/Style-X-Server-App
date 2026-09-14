import { PrismaService } from 'src/prisma/prisma.service';
import { ReportLowStockService } from './report-low-stock.service';
import { ReportMapperService } from './report-mapper.service';
import { ReportSorterService } from './report-sorter.service';

describe('ReportLowStockService', () => {
  it('returns low-stock variants ordered by total on-hand quantity', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        title: 'M',
        skuCode: 'SKU-1',
        barCode: 'BAR-1',
        product: {
          id: 10,
          skuCode: 'P-SKU-1',
          barCode: 'P-BAR-1',
          name: 'Tee',
          vendor: 'Vendor',
          type: 'Shirt',
        },
        inventories: [
          { id: 1, onHand: 10, warehouse: { id: 1, name: 'Main' } },
        ],
      },
    ]);
    const prisma = {
      productVariants: { findMany },
    } as unknown as PrismaService;
    const service = new ReportLowStockService(
      prisma,
      new ReportMapperService(new ReportSorterService())
    );

    await expect(service.get()).resolves.toEqual([
      {
        onHand: 10,
        product: { id: 10, name: 'Tee', type: 'Shirt', vendor: 'Vendor' },
        variant: {
          id: 1,
          barCode: 'BAR-1',
          skuCode: 'SKU-1',
          title: 'M',
        },
        warehouses: [{ id: 1, name: 'Main', onHand: 10 }],
      },
    ]);
  });
});
