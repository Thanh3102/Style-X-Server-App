import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { AuthenticatedRequest } from 'src/utils/types';
import {
  AddItemDto,
  UpdateItemQuantityDto,
  UpdateItemVariantDto,
} from '../cart.dto';
import { CartCustomerCommandService } from './cart-customer-command.service';
import { CartCustomerQueryService } from './cart-customer-query.service';
import { CartOperationResult } from './cart-command.types';
import { CartPricingService } from './cart-pricing.service';
import { CartSyncService } from './cart-sync.service';

type CustomerRequest = AuthenticatedRequest | string;

@Injectable()
export class CartCustomerService {
  private readonly logger = new Logger(CartCustomerService.name);

  constructor(
    private readonly queryService: CartCustomerQueryService,
    private readonly commandService: CartCustomerCommandService,
    private readonly pricingService: CartPricingService,
    private readonly syncService: CartSyncService
  ) {}

  async getItems(request: CustomerRequest, res: Response): Promise<Response> {
    try {
      const cart = await this.queryService.findUserCartById(
        this.getUserId(request)
      );
      const items = cart ? await this.queryService.findCartItems(cart.id) : [];
      const pricedCart = await this.pricingService.calculate(items);
      return res.status(200).json(this.toPricingResponse(pricedCart));
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  getCartItemsData(prisma: PrismaTransactionClient, ids: number[]) {
    return this.queryService.getCartItemsData(prisma, ids);
  }

  async addItem(
    dto: AddItemDto,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() =>
        this.commandService.addItem(dto, this.getUserId(req))
      )
    );
  }

  async updateItemQuantity(
    dto: UpdateItemQuantityDto,
    res: Response
  ): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() => this.commandService.updateItemQuantity(dto))
    );
  }

  async deleteItem(id: number, res: Response): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() => this.commandService.deleteItem(id))
    );
  }

  async updateSelectedItems(
    itemIds: number[],
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() =>
        this.commandService.updateSelectedItems(this.getUserId(req), itemIds)
      )
    );
  }

  async updateItemVariant(
    itemId: number,
    newVariantId: number,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    const dto: UpdateItemVariantDto = { itemId, newVariantId };
    return this.respond(
      res,
      await this.execute(() =>
        this.commandService.updateItemVariant(this.getUserId(req), dto)
      )
    );
  }

  async syncCart(
    guestCartId: string | null,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const result = await this.syncService.syncCart(
        this.getUserId(req),
        guestCartId
      );
      return res.status(200).json(result);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Đã xảy ra lỗi',
      });
    }
  }

  private async execute(
    operation: () => Promise<CartOperationResult>
  ): Promise<CartOperationResult> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.logError(error);
      return {
        status: 500,
        body: { message: 'Đã xảy ra lỗi' },
      };
    }
  }

  private respond(res: Response, result: CartOperationResult): Response {
    return res.status(result.status).json(result.body);
  }

  private getUserId(request: CustomerRequest): string {
    return typeof request === 'string' ? request : String(request.user.id);
  }

  private toPricingResponse(pricedCart: {
    finalItems: unknown[];
    applyOrderPromotions: unknown[];
    totalItemBeforeDiscount: number;
    totalItemAfterDiscount: number;
    totalItemDiscountAmount: number;
    totalOrderBeforeDiscount: number;
    totalOrderAfterDiscount: number;
    totalOrderDiscountAmount: number;
  }): Record<string, unknown> {
    return {
      data: pricedCart.finalItems,
      applyOrderPromotions: pricedCart.applyOrderPromotions,
      totalItemBeforeDiscount: pricedCart.totalItemBeforeDiscount,
      totalItemAfterDiscount: pricedCart.totalItemAfterDiscount,
      totalItemDiscountAmount: pricedCart.totalItemDiscountAmount,
      totalOrderBeforeDiscount: pricedCart.totalOrderBeforeDiscount,
      totalOrderAfterDiscount: pricedCart.totalOrderAfterDiscount,
      totalOrderDiscountAmount: pricedCart.totalOrderDiscountAmount,
    };
  }

  private logError(error: unknown): void {
    this.logger.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
  }
}
