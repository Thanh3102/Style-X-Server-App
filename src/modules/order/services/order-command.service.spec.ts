import { Response } from 'express';
import { OrderCommandService } from './order-command.service';
import { OrderVoucherApplicationService } from './order-voucher-application.service';

describe('OrderCommandService', () => {
  const response = () => {
    const res = {
      status: jest.fn(),
      json: jest.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  };

  const createService = (apply: jest.Mock) =>
    new OrderCommandService(
      { apply } as unknown as OrderVoucherApplicationService,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );

  it('keeps the existing success response while delegating voucher application', async () => {
    const apply = jest.fn().mockResolvedValue(undefined);
    const service = createService(apply);
    const res = response();

    await service.applyVoucher('order-1', 'SAVE10', res as unknown as Response);

    expect(apply).toHaveBeenCalledWith('order-1', 'SAVE10');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Sử dụng mã giảm giá thành công',
    });
  });

  it('keeps the existing 500 error response when application fails', async () => {
    const apply = jest.fn().mockRejectedValue(new Error('voucher failed'));
    const service = createService(apply);
    const res = response();

    await service.applyVoucher('order-1', 'SAVE10', res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'voucher failed' });
  });
});
