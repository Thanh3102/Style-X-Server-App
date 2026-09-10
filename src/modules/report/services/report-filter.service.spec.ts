import { OrderStatus } from '../../order/order.type';
import { ReportDateRange } from './report-date-range.service';
import { ReportFilterService } from './report-filter.service';

describe('ReportFilterService', () => {
  it('builds the completed-order filter with the shared date range', () => {
    const service = new ReportFilterService();
    const range: ReportDateRange = {
      startDate: new Date('2026-02-05'),
      endDate: new Date('2026-02-14'),
    };

    expect(service.completedOrder(range)).toEqual({
      void: false,
      status: OrderStatus.COMPLETE,
      createdAt: {
        gte: new Date('2026-02-05'),
        lte: new Date('2026-02-14'),
      },
    });
  });

  it('composes product and order-item filters from the same completed-order rule', () => {
    const service = new ReportFilterService();
    const range: ReportDateRange = {
      startDate: new Date('2026-02-05'),
      endDate: new Date('2026-02-14'),
    };

    expect(service.productWithCompletedOrders(range)).toEqual({
      orderItems: {
        some: {
          order: {
            void: false,
            status: OrderStatus.COMPLETE,
            createdAt: {
              gte: new Date('2026-02-05'),
              lte: new Date('2026-02-14'),
            },
          },
        },
      },
    });

    expect(service.orderItemsForProduct(7, range)).toEqual({
      productId: 7,
      order: {
        void: false,
        status: OrderStatus.COMPLETE,
        createdAt: {
          gte: new Date('2026-02-05'),
          lte: new Date('2026-02-14'),
        },
      },
    });
  });
});
