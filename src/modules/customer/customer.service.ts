import { Injectable, Logger } from '@nestjs/common';
import type { Customer } from '@prisma/client';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { AuthenticatedRequest, QueryParams } from 'src/utils/types';
import { ChangePasswordDto, UpdateInfoDto } from './customer.type';
import { CustomerCredentialService } from './services/customer-credential.service';
import { CustomerProfileService } from './services/customer-profile.service';
import {
  CustomerOrderHistoryQuery,
  CustomerQueryService,
} from './services/customer-query.service';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private readonly queryService: CustomerQueryService,
    private readonly profileService: CustomerProfileService,
    private readonly credentialService: CustomerCredentialService
  ) {}

  async get(queryParams: QueryParams, res: Response): Promise<Response> {
    try {
      return res
        .status(200)
        .json(await this.queryService.getCustomers(queryParams));
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getDetail(
    customerId: string,
    query: QueryParams,
    res: Response
  ): Promise<Response> {
    try {
      return res
        .status(200)
        .json(await this.queryService.getDetail(customerId, query));
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getInfo(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      return res
        .status(200)
        .json(await this.profileService.getInfo(req.user.id as string));
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async updateInfo(
    dto: UpdateInfoDto,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.profileService.updateInfo(req.user.id as string, dto);
      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async changePassword(
    dto: ChangePasswordDto,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.profileService.changePassword(req.user.id as string, dto);
      return res.status(200).json({ message: 'Đã cập nhật mật khẩu' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getOrderHistory(
    query: CustomerOrderHistoryQuery,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      return res
        .status(200)
        .json(
          await this.queryService.getOrderHistory(query, req.user.id as string)
        );
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async createForgetPasswordToken(
    email: string,
    res: Response
  ): Promise<Response> {
    try {
      await this.credentialService.createForgetPasswordToken(email);
      return res.status(200).json({
        message:
          'Yêu cầu đặt lại mật khẩu đã gửi. Vui lòng kiểm tra email của bạn',
      });
    } catch (error: unknown) {
      return this.internalServerError(
        res,
        error,
        'Đã xảy ra lỗi. Vui lòng thử lại'
      );
    }
  }

  async resetPassword(
    requestToken: string,
    newPassword: string,
    res: Response
  ): Promise<Response> {
    try {
      await this.credentialService.resetPassword(requestToken, newPassword);
      return res.status(200).json({ message: 'Cập nhật mật khẩu thành công' });
    } catch (error: unknown) {
      return this.internalServerError(
        res,
        error,
        'Đã xảy ra lỗi. Vui lòng thử lại'
      );
    }
  }

  verifyCustomer(email: string, password: string): Promise<Customer> {
    return this.credentialService.verifyCustomer(email, password);
  }

  private internalServerError(
    res: Response,
    error: unknown,
    fallback = 'Đã xảy ra lỗi'
  ): Response {
    this.logger.error(getErrorMessage(error, fallback), getErrorStack(error));
    return res.status(500).json({
      message: getErrorMessage(error, fallback),
    });
  }
}
