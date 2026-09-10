import { PrismaService } from 'src/prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { CartCheckoutService } from 'src/modules/cart/services/cart-checkout.service';
import { DiscountService } from 'src/modules/discount/discount.service';
import { OrderCalculationService } from './order-calculation.service';
import { OrderInventoryService } from './order-inventory.service';
import { OrderTemporaryCreationService } from './order-temporary-creation.service';
import { OrderPaymentService } from './order-payment.service';

const makeItem = (available = 2) => ({
  quantity: 2,
  product: { id: 11, name: 'Áo thun' },
  variant: {
    id: 22,
    title: 'Đỏ',
    sellPrice: 100000,
    costPrice: 60000,
    inventories: [{ avaiable: available }],
  },
});

const makeService = (items = [makeItem()]) => {
  const orderCreate = jest.fn().mockResolvedValue({ id: 'order-1' });
  const transactionClient = {
    order: { create: orderCreate },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>
      ) => callback(transactionClient)
    ),
  } as unknown as PrismaService;
  const cartCheckout = {
    getCartItemsData: jest.fn().mockResolvedValue(items),
  } as unknown as CartCheckoutService;
  const calculation = {
    calculateItem: jest.fn().mockResolvedValue({
      applyPromotions: [],
      discountAmount: 0,
      priceAfterDiscount: 100000,
    }),
  } as unknown as OrderCalculationService;
  const inventory = {
    findItemReceive: jest
      .fn()
      .mockResolvedValue([
        { receiveId: 4, warehouseId: 5, quantity: 2, costPrice: 60000 },
      ]),
  } as unknown as OrderInventoryService;
  const discount = {
    getActiveDiscounts: jest.fn().mockResolvedValue([]),
  } as unknown as DiscountService;

  return {
    service: new OrderTemporaryCreationService(
      prisma,
      calculation,
      inventory,
      cartCheckout,
      discount
    ),
    transactionClient,
    orderCreate,
    cartCheckout,
    inventory,
  };
};

describe('OrderTemporaryCreationService', () => {
  it('returns the existing stock-shortage message without creating an order', async () => {
    const { service, orderCreate } = makeService([makeItem(1)]);

    await expect(
      service.create({ type: 'Guest', cartItemIds: [1] })
    ).resolves.toEqual({
      status: 400,
      body: {
        message:
          'Sản phẩm Áo thun (Đỏ) không còn đủ số lượng hoặc đã hết hàng. Vui lòng giảm số lượng',
      },
    });

    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('persists a minimally priced order, item, source, and history in the transaction client', async () => {
    const { service, transactionClient, orderCreate, cartCheckout, inventory } =
      makeService();

    await expect(
      service.create({ type: 'Customer', cartItemIds: [1] }, 'customer-1')
    ).resolves.toEqual({ status: 200, body: { id: 'order-1' } });

    expect(cartCheckout.getCartItemsData).toHaveBeenCalledWith(
      transactionClient,
      'Customer',
      [1]
    );
    expect(inventory.findItemReceive).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2 }),
      transactionClient
    );
    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalItemBeforeDiscount: 200000,
          totalItemAfterDiscount: 200000,
          totalItemDiscountAmount: 0,
          totalOrderBeforeDiscount: 200000,
          totalOrderAfterDiscount: 200000,
          totalOrderDiscountAmount: 0,
          history: {
            create: expect.objectContaining({
              changedCustomerId: 'customer-1',
            }),
          },
        }),
      })
    );
    expect(transactionClient.orderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          sources: {
            createMany: {
              data: [
                { receiveId: 4, warehouseId: 5, quantity: 2, costPrice: 60000 },
              ],
            },
          },
        }),
      })
    );
  });

  it('omits changedCustomerId from guest order history', async () => {
    const { service, orderCreate } = makeService();

    await service.create({ type: 'Guest', cartItemIds: [1] }, 'ignored-actor');

    const history = orderCreate.mock.calls[0][0].data.history.create;
    expect(history).not.toHaveProperty('changedCustomerId');
  });
});

describe('OrderPaymentService.createTempOrder', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeResponse = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { status, json };
  };

  it('maps a temporary order result and customer actor id to the existing HTTP response', async () => {
    const create = jest
      .fn()
      .mockResolvedValue({ status: 200, body: { id: 'order-1' } });
    const service = new (OrderPaymentService as any)(
      { create } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    const response = makeResponse();

    await service.createTempOrder(
      { type: 'Customer', cartItemIds: [1] },
      { user: { id: 'customer-1' } },
      response as never
    );

    expect(create).toHaveBeenCalledWith(
      { type: 'Customer', cartItemIds: [1] },
      'customer-1'
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ id: 'order-1' });
  });

  it('keeps the existing 500 response when temporary order creation throws', async () => {
    const service = new (OrderPaymentService as any)(
      {
        create: jest.fn().mockRejectedValue(new Error('database down')),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    const response = makeResponse();

    await service.createTempOrder(
      { type: 'Guest', cartItemIds: [1] },
      {},
      response as never
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Đã xảy ra lỗi khi tạo hóa đơn. Vui lòng thử lại',
    });
  });
});
