import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { AuthenticatedRequest } from 'src/utils/types';
import { QueryParams } from 'src/utils/types/query.types';
import { WarehouseCommandService } from './services/warehouse-command.service';
import {
  WarehouseDetailResult,
  WarehouseListItem,
  WarehouseQueryService,
} from './services/warehouse-query.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './warehouses.type';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(
    private readonly queryService: WarehouseQueryService,
    private readonly commandService: WarehouseCommandService
  ) {}

  get(queryParams: QueryParams): Promise<WarehouseListItem[]> {
    return this.queryService.getWarehouses(queryParams);
  }

  async create(
    dto: CreateWarehouseDto,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.commandService.createWarehouse(dto, req.user.id as number);
      return res.status(200).json({ message: 'Tạo kho hàng thành công' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async update(
    dto: UpdateWarehouseDto,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.commandService.updateWarehouse(dto, req.user.id as number);
      return res.status(200).json({ message: 'Cập nhật thành công' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getDetail(
    warehouseId: number,
    params: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      const detail: WarehouseDetailResult =
        await this.queryService.getWarehouseDetail(warehouseId, params);
      return res.status(200).json(detail);
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  private internalServerError(res: Response, error: unknown): Response {
    this.logger.error(getErrorMessage(error), getErrorStack(error));
    return res.status(500).json({ message: getErrorMessage(error) });
  }
}
