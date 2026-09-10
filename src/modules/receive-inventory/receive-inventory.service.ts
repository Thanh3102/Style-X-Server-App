import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest, QueryParams } from 'src/utils/types';
import {
  CancelReceiveInventoryDTO,
  CreateReceiveInventoryDTO,
  ImportItemDTO,
  ProcessPaymentDTO,
  UpdateReceiveInventoryDTO,
} from './receive-inventory.type';
import { ReceiveInventoryDraftService } from './services/receive-inventory-draft.service';
import { ReceiveInventoryQueryService } from './services/receive-inventory-query.service';
import { ReceiveInventoryTransactionService } from './services/receive-inventory-transaction.service';

@Injectable()
export class ReceiveInventoryService {
  constructor(
    private readonly queryService: ReceiveInventoryQueryService,
    private readonly draftService: ReceiveInventoryDraftService,
    private readonly transactionService: ReceiveInventoryTransactionService
  ) {}

  getTags(receiveId: number): Promise<string[]> {
    return this.queryService.getTags(receiveId);
  }

  async create(
    dto: CreateReceiveInventoryDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = await this.draftService.create(dto, this.employeeId(req));
      return res.json({ id, message: 'Tạo đơn nhập hàng thành công' });
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  async update(
    dto: UpdateReceiveInventoryDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.draftService.update(dto, this.employeeId(req));
      return res.json({ message: 'Cập nhật đơn hàng thành công' });
    } catch (error: unknown) {
      this.rethrow(error);
    }
  }

  async get(queryParams: QueryParams, res: Response): Promise<Response> {
    return res.json(await this.queryService.get(queryParams));
  }

  async getDetail(receiveId: number, res: Response): Promise<Response> {
    try {
      return res.json(await this.queryService.getDetail(receiveId));
    } catch (error: unknown) {
      throw new InternalServerErrorException(error);
    }
  }

  async import(
    dto: ImportItemDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.transactionService.import(dto, this.employeeId(req));
      return res.json({ message: 'Đã cập nhật tồn kho ' });
    } catch (error: unknown) {
      throw new InternalServerErrorException(error);
    }
  }

  async processPayment(
    dto: ProcessPaymentDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.transactionService.processPayment(dto, this.employeeId(req));
      return res.json({ message: 'Cập nhật đơn nhập thành công' });
    } catch (error: unknown) {
      throw new InternalServerErrorException(error);
    }
  }

  async cancel(
    dto: CancelReceiveInventoryDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.transactionService.cancel(dto, this.employeeId(req));
      return res.json({ message: 'Đã hủy đơn nhập' });
    } catch (error: unknown) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    id: number,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.transactionService.delete(id, this.employeeId(req));
      return res.json({ message: 'Xóa đơn nhập thành công' });
    } catch (error: unknown) {
      throw new InternalServerErrorException(error);
    }
  }

  private employeeId(req: AuthenticatedRequest): number {
    return Number(req.user.id);
  }

  private rethrow(error: unknown): never {
    if (error instanceof BadRequestException) throw error;
    throw new InternalServerErrorException(error);
  }
}
