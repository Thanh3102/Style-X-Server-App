import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { QueryParams } from 'src/utils/types';
import type { CartItemData } from '../cart/cart.type';
import type {
  ActiveDiscount,
  CreateDiscountDTO,
  UpdateDiscountDTO,
  Voucher,
} from './discount.type';
import type {
  ActiveDiscountOptions,
  ActiveDiscountResult,
  DiscountListResult,
  VoucherResult,
} from './discount-query.type';
import {
  DiscountCalculationService,
  DiscountOrderResult,
  ItemDiscountResult,
  VariantDiscountResult,
} from './services/discount-calculation.service';
import { DiscountCommandService } from './services/discount-command.service';
import { DiscountExpirationService } from './services/discount-expiration.service';
import { DiscountQueryService } from './services/discount-query.service';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(
    private readonly queryService: DiscountQueryService,
    private readonly commandService: DiscountCommandService,
    private readonly calculationService: DiscountCalculationService,
    private readonly expirationService: DiscountExpirationService
  ) {}

  updateExpireDiscount(): Promise<void> {
    return this.expirationService.updateExpireDiscount();
  }

  async create(
    dto: CreateDiscountDTO,
    req: { user: { id: number } },
    res: Response
  ): Promise<Response> {
    try {
      if (await this.commandService.hasTitleConflict(dto.mode, dto.title)) {
        return res.status(400).json({ message: 'Tên khuyến mại đã tồn tại' });
      }

      const discount = await this.commandService.create(dto, req.user.id);
      return res
        .status(200)
        .json({ id: discount.id, messge: 'Tạo khuyến mại thành công' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getDetail(id: string, res: Response): Promise<Response> {
    try {
      const discount = await this.queryService.getDetail(id);
      return res.json(discount);
    } catch (error: unknown) {
      throw new InternalServerErrorException(error);
    }
  }

  async get(queryParams: QueryParams, res: Response): Promise<Response> {
    try {
      const preparedQuery = this.queryService.prepareListQuery(queryParams);
      const result: DiscountListResult =
        await this.queryService.get(preparedQuery);
      return res.json(result);
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    dto: UpdateDiscountDTO,
    _req: { user: { id: number } },
    res: Response
  ): Promise<Response> {
    try {
      const mode = await this.commandService.getMode(dto.id);
      if (
        await this.commandService.hasTitleConflict(
          mode ?? '',
          dto.title,
          dto.id
        )
      ) {
        return res.status(400).json({ message: 'Tên khuyến mại đã tồn tại' });
      }

      await this.commandService.update(dto);
      return res.json({ message: 'Cập nhật khuyến mại thành công' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: getErrorMessage(error) || 'Đã xảy ra lỗi',
      });
    }
  }

  async updateActive(
    id: number,
    active: boolean,
    res: Response
  ): Promise<Response> {
    try {
      await this.commandService.updateActive(id, active);
      return res.json({ message: 'Đã cập nhật trạng thái' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: getErrorMessage(error),
      });
    }
  }

  async delete(id: number, res: Response): Promise<Response> {
    try {
      await this.commandService.delete(id);
      return res.json({ message: 'Đã xóa khuyến mại' });
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        message: getErrorMessage(error),
      });
    }
  }

  getActiveDiscounts(
    options: ActiveDiscountOptions
  ): Promise<ActiveDiscountResult[]> {
    return this.queryService.getActiveDiscounts(options);
  }

  calcVariantDiscount(
    variant: { sellPrice: number; id: number },
    activeProductPromotions: ActiveDiscount[],
    options?: { withPrerequire?: boolean }
  ): Promise<VariantDiscountResult> {
    return this.calculationService.calcVariantDiscount(
      variant,
      activeProductPromotions,
      options
    );
  }

  calcOrderDiscount(items: CartItemData[]): Promise<DiscountOrderResult> {
    return this.calculationService.calcOrderDiscount(items);
  }

  calcItemDiscount(
    item: CartItemData,
    activeProductPromotions: ActiveDiscount[]
  ): Promise<ItemDiscountResult> {
    return this.calculationService.calcItemDiscount(
      item,
      activeProductPromotions
    );
  }

  findVoucher(title: string): Promise<VoucherResult | null> {
    return this.queryService.findVoucher(title);
  }

  private logError(error: unknown): void {
    this.logger.error(getErrorMessage(error), getErrorStack(error));
  }
}

export type { Voucher };
