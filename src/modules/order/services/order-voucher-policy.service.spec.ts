import { PrismaService } from 'src/prisma/prisma.service';
import { ProductQueryService } from 'src/modules/product/services/product-query.service';
import { OrderVoucherPolicyService } from './order-voucher-policy.service';

describe('OrderVoucherPolicyService', () => {
  it('rejects a voucher that has not started yet', async () => {
    const service = new OrderVoucherPolicyService({} as ProductQueryService);
    const voucher = {
      startOn: new Date(Date.now() + 60_000),
      endOn: null,
    } as never;

    await expect(
      service.assertCanApply(
        {} as PrismaService,
        { id: 'order-1' } as never,
        voucher
      )
    ).rejects.toThrow('Mã giảm giá không trong thời gian áp dụng');
  });
});
