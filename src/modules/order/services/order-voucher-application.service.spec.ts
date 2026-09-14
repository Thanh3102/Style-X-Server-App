import { DiscountService } from 'src/modules/discount/discount.service';
import { ProductQueryService } from 'src/modules/product/services/product-query.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderQueryService } from './order-query.service';
import { OrderVoucherApplicationService } from './order-voucher-application.service';
import { OrderVoucherPolicyService } from './order-voucher-policy.service';

describe('OrderVoucherApplicationService', () => {
  const createTransactionClient = () => ({
    order: { update: jest.fn() },
    orderItem: { update: jest.fn() },
    orderItemApplyDiscount: { create: jest.fn() },
    orderApplyDiscount: { create: jest.fn() },
    orderApplyVoucher: { create: jest.fn() },
    discount: { update: jest.fn() },
  });

  const createService = (
    order: unknown,
    voucher: unknown,
    transactionClient = createTransactionClient(),
    assertCanApply = jest.fn().mockResolvedValue(true)
  ) => {
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new OrderVoucherApplicationService(
      prisma,
      {
        getOrderDetail: jest.fn().mockResolvedValue(order),
      } as unknown as OrderQueryService,
      {
        findVoucher: jest.fn().mockResolvedValue(voucher),
      } as unknown as DiscountService,
      {} as ProductQueryService,
      {
        assertCanApply,
      } as unknown as OrderVoucherPolicyService
    );

    return { service, transactionClient, assertCanApply, prisma };
  };

  it('applies a 10% product voucher inside one transaction', async () => {
    const order = {
      id: 'order-1',
      totalItemAfterDiscount: 200_000,
      totalItemDiscountAmount: 0,
      totalOrderBeforeDiscount: 200_000,
      totalOrderAfterDiscount: 200_000,
      totalOrderDiscountAmount: 0,
      applyDiscounts: [],
      items: [
        {
          id: 11,
          variantId: 101,
          quantity: 2,
          priceAfterDiscount: 100_000,
          totalPriceBeforeDiscount: 200_000,
          applyDiscounts: [],
        },
      ],
    };
    const voucher = {
      id: 22,
      type: 'product',
      entitle: 'all',
      prerequisite: 'none',
      valueType: 'percent',
      value: 10,
      valueLimitAmount: null,
      combinesWithOrderDiscount: true,
      combinesWithProductDiscount: true,
    };
    const { service, transactionClient, prisma } = createService(
      order,
      voucher
    );

    await service.apply('order-1', 'PRODUCT10');

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 30_000,
      timeout: 30_000,
    });
    expect(transactionClient.orderItem.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        priceAfterDiscount: 90_000,
        discountAmount: { increment: 10_000 },
        totalPriceAfterDiscount: 180_000,
        totalDiscountAmount: 20_000,
      },
    });
    expect(
      transactionClient.orderItemApplyDiscount.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountAmount: 10_000,
          orderItemId: 11,
        }),
      })
    );
    expect(transactionClient.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        totalItemAfterDiscount: 180_000,
        totalItemDiscountAmount: 20_000,
        totalOrderAfterDiscount: 180_000,
      },
    });
    expect(transactionClient.orderApplyVoucher.create).toHaveBeenCalledWith({
      data: { discountId: 22, orderId: 'order-1' },
    });
    expect(transactionClient.discount.update).toHaveBeenCalledTimes(1);
    expect(transactionClient.discount.update).toHaveBeenCalledWith({
      where: { id: 22 },
      data: { usage: { increment: 1 } },
    });
  });

  it('applies a fixed order voucher to the current remaining total', async () => {
    const order = {
      id: 'order-2',
      totalItemAfterDiscount: 150_000,
      totalOrderBeforeDiscount: 150_000,
      totalOrderAfterDiscount: 150_000,
      totalOrderDiscountAmount: 0,
      applyDiscounts: [],
      items: [],
    };
    const voucher = {
      id: 23,
      type: 'order',
      prerequisite: 'none',
      valueType: 'value',
      value: 20_000,
      valueLimitAmount: null,
      combinesWithOrderDiscount: true,
      combinesWithProductDiscount: true,
    };
    const { service, transactionClient } = createService(order, voucher);

    await service.apply('order-2', 'ORDER20');

    expect(transactionClient.order.update).toHaveBeenCalledWith({
      where: { id: 'order-2' },
      data: {
        totalOrderAfterDiscount: 130_000,
        totalOrderDiscountAmount: 20_000,
      },
    });
    expect(transactionClient.orderApplyDiscount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountAmount: 20_000,
          orderId: 'order-2',
        }),
      })
    );
  });

  it('does not mutate an order when voucher policy rejects it', async () => {
    const transactionClient = createTransactionClient();
    const policyError = new Error('policy rejected');
    const { service, assertCanApply } = createService(
      { id: 'order-3', items: [], applyDiscounts: [] },
      { id: 24, type: 'order' },
      transactionClient,
      jest.fn().mockRejectedValue(policyError)
    );

    await expect(service.apply('order-3', 'REJECTED')).rejects.toThrow(
      policyError
    );
    expect(assertCanApply).toHaveBeenCalledTimes(1);
    expect(transactionClient.order.update).not.toHaveBeenCalled();
    expect(transactionClient.orderItem.update).not.toHaveBeenCalled();
    expect(
      transactionClient.orderItemApplyDiscount.create
    ).not.toHaveBeenCalled();
    expect(transactionClient.orderApplyDiscount.create).not.toHaveBeenCalled();
    expect(transactionClient.orderApplyVoucher.create).not.toHaveBeenCalled();
    expect(transactionClient.discount.update).not.toHaveBeenCalled();
  });
});
