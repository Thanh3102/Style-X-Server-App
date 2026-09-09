import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { AuthenticatedRequest, QueryParams } from 'src/utils/types';
import { ChangeOnHandDTO, CreateInventoryDTO } from './inventories.type';
import {
  InventoryHistoryQueryService,
  InventoryHistoryResult,
} from './services/inventory-history-query.service';
import {
  InventoryQueryService,
  VariantWarehouse,
} from './services/inventory-query.service';
import { InventoryStockService } from './services/inventory-stock.service';

@Injectable()
export class InventoriesService {
  private readonly logger = new Logger(InventoriesService.name);

  constructor(
    private readonly stockService: InventoryStockService,
    private readonly queryService: InventoryQueryService,
    private readonly historyQueryService: InventoryHistoryQueryService
  ) {}

  async create(
    dto: CreateInventoryDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    const requestUserId = req.user.id as number;

    try {
      await this.stockService.createInventories(dto, requestUserId);
      return res.json({ message: 'Thêm kho lưu trữ thành công.' });
    } catch (error: unknown) {
      this.throwInternalServerError(error);
    }
  }

  async changeOnHand(
    dto: ChangeOnHandDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    const requestUserId = req.user.id as number;

    try {
      await this.stockService.changeOnHand(dto, requestUserId);
      return res.json({ message: 'Cập nhật tồn kho thành công' });
    } catch (error: unknown) {
      this.throwInternalServerError(error);
    }
  }

  async getHistory(queryParams: QueryParams): Promise<InventoryHistoryResult> {
    return this.historyQueryService.getHistory(queryParams);
  }

  async getVariantWarehouses(variantId: number): Promise<VariantWarehouse[]> {
    try {
      return await this.queryService.getVariantWarehouses(variantId);
    } catch (error: unknown) {
      throw new InternalServerErrorException(error as object | string);
    }
  }

  private throwInternalServerError(error: unknown): never {
    const message = getErrorMessage(error);
    this.logger.error(message, getErrorStack(error));
    throw new InternalServerErrorException(message);
  }
}
