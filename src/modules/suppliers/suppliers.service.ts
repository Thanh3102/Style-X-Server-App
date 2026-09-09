import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { AuthenticatedRequest, QueryParams } from 'src/utils/types';
import { TagsService } from '../tags/tags.service';
import { SupplierCommandService } from './services/supplier-command.service';
import { SupplierQueryService } from './services/supplier-query.service';
import { SupplierValidationService } from './services/supplier-validation.service';
import {
  CheckCodeOptions,
  CreateSupplierDTO,
  UpdateSupplierDTO,
} from './suppliers.type';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly commandService: SupplierCommandService,
    private readonly queryService: SupplierQueryService,
    private readonly validationService: SupplierValidationService,
    private readonly _tagService: TagsService
  ) {}

  async create(
    dto: CreateSupplierDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    const userId = req.user.id as number;
    await this.checkCode(dto.code);

    try {
      const supplierId = await this.commandService.create(dto, userId);
      return res.status(200).json({ status: 'success', id: supplierId });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi tạo nhà cung cấp'
      );
    }
  }

  async update(
    dto: UpdateSupplierDTO,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    await this.checkCode(dto.code, { checkExist: false });
    const requestUserId = req.user.id as number;

    try {
      const supplierId = await this.commandService.update(dto, requestUserId);
      return res.status(200).json({
        status: 'success',
        id: supplierId,
        message: 'Lưu nhà cung cấp thành công',
      });
    } catch (error: unknown) {
      this.logError(error);
      throw new InternalServerErrorException('Đã xảy ra lỗi khi cập nhật');
    }
  }

  async delete(
    id: number,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | undefined> {
    const requestUserId = req.user.id as number;
    try {
      await this.commandService.delete(id, requestUserId);
      return res.status(200).json({ status: 'success' });
    } catch (error: unknown) {
      this.logError(error);
    }
  }

  async getData(
    res: Response,
    queryParams: QueryParams
  ): Promise<Response | undefined> {
    const preparedQuery = this.queryService.prepareListQuery(queryParams);

    try {
      const result = await this.queryService.getData(preparedQuery);
      return res.status(200).json(result);
    } catch (error: unknown) {
      this.logError(error);
    }
  }

  async getDetail(id: string | undefined, res: Response): Promise<Response> {
    try {
      const supplier = await this.queryService.getDetail(id);
      return res.status(200).json(supplier);
    } catch (error: unknown) {
      this.logError(error);
      if (error instanceof HttpException) throw error;
      return res.status(500).json({
        message: 'Hệ thống đã xảy ra lỗi',
      });
    }
  }

  checkCode(
    code: string | undefined,
    options: CheckCodeOptions = { checkExist: true, checkPrefix: true }
  ): Promise<void> {
    return this.validationService.checkCode(code, options);
  }

  private logError(error: unknown): void {
    this.logger.error(getErrorMessage(error), getErrorStack(error));
  }
}
