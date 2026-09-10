import { MailService } from 'src/modules/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderNotificationService } from './order-notification.service';

describe('OrderFulfillmentService', () => {
  it('keeps delivery status and inventory updates in a transaction', async () => {
    const update = jest.fn().mockResolvedValue({
      code: 'ORDER-1',
      name: 'Buyer',
      email: 'buyer@example.com',
      province: 'P',
      district: 'D',
      ward: 'W',
      address: 'A',
      items: [],
    });
    const transactionClient = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ transactionStatus: 'paid' }),
        update,
      },
      inventory: { findFirst: jest.fn(), update: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const service = new OrderFulfillmentService(
      prisma,
      {} as OrderNotificationService
    );

    await service.confirmDelivery('order-1', false, 7);

    expect(update).toHaveBeenCalled();
  });

  it('keeps delivery persisted when its notification fails after the transaction commits', async () => {
    const deliveredOrder = {
      code: 'ORDER-1',
      name: 'Buyer',
      email: 'buyer@example.com',
      province: 'P',
      district: 'D',
      ward: 'W',
      address: 'A',
      items: [],
    };
    const transactionClient = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ transactionStatus: 'paid' }),
        update: jest.fn().mockResolvedValue(deliveredOrder),
      },
      inventory: { findFirst: jest.fn(), update: jest.fn() },
    };
    let transactionResolved = false;
    const prisma = {
      $transaction: jest.fn(
        async (
          callback: (client: typeof transactionClient) => Promise<unknown>
        ) => {
          const result = await callback(transactionClient);
          transactionResolved = true;
          return result;
        }
      ),
    } as unknown as PrismaService;
    const mailService = {
      sendUserDeliveryConfirmNotification: jest.fn(async () => {
        expect(transactionResolved).toBe(true);
        throw new Error('mail provider unavailable');
      }),
    } as unknown as MailService;
    const notificationService = new OrderNotificationService(mailService);
    const service = new OrderFulfillmentService(prisma, notificationService);

    await expect(
      service.confirmDelivery('order-1', true, 7)
    ).resolves.toBeUndefined();

    expect(
      mailService.sendUserDeliveryConfirmNotification
    ).toHaveBeenCalledWith(deliveredOrder);
  });

  it('rejects delivery before inventory mutation when an order source has no inventory', async () => {
    const inventoryUpdate = jest.fn();
    const transactionClient = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ transactionStatus: 'paid' }),
        update: jest.fn().mockResolvedValue({
          items: [
            {
              variantId: 21,
              sources: [{ warehouseId: 4, quantity: 2 }],
            },
          ],
        }),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: inventoryUpdate,
      },
    };
    const service = new OrderFulfillmentService(
      {
        $transaction: jest.fn(
          async (
            callback: (client: typeof transactionClient) => Promise<unknown>
          ) => callback(transactionClient)
        ),
      } as unknown as PrismaService,
      {} as OrderNotificationService
    );

    await expect(service.confirmDelivery('order-1', false, 7)).rejects.toThrow(
      'order-1'
    );
    expect(inventoryUpdate).not.toHaveBeenCalled();
  });

  it('rejects payment receipt before inventory mutation when an order source has no inventory', async () => {
    const inventoryUpdate = jest.fn();
    const transactionClient = {
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'order-1',
          items: [
            {
              variantId: 21,
              sources: [{ warehouseId: 4, quantity: 2 }],
            },
          ],
        }),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: inventoryUpdate,
      },
    };
    const service = new OrderFulfillmentService(
      {
        $transaction: jest.fn(
          async (
            callback: (client: typeof transactionClient) => Promise<unknown>
          ) => callback(transactionClient)
        ),
      } as unknown as PrismaService,
      {} as OrderNotificationService
    );

    await expect(service.confirmPaymentReceived('order-1', 7)).rejects.toThrow(
      'order-1'
    );
    expect(inventoryUpdate).not.toHaveBeenCalled();
  });
});
