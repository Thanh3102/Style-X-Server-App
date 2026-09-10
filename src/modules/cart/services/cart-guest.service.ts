import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import {
  AddGuestItemDto,
  UpdateGuestItemVariantDto,
  UpdateItemQuantityDto,
} from '../cart.dto';
import { CartGuestCommandService } from './cart-guest-command.service';
import { CartGuestQueryService } from './cart-guest-query.service';
import { CartOperationResult } from './cart-command.types';
import { CartPricingService } from './cart-pricing.service';

@Injectable()
export class CartGuestService {
  private readonly logger = new Logger(CartGuestService.name);

  constructor(
    private readonly queryService: CartGuestQueryService,
    private readonly commandService: CartGuestCommandService,
    private readonly pricingService: CartPricingService
  ) {}

  async getGuestItems(cartId: string | null, res: Response): Promise<Response> {
    try {
      if (!cartId) {
        const createdCart = await this.commandService.createGuestCart();
        return res.status(200).json({ id: createdCart.id, data: [] });
      }

      const cart = await this.queryService.findGuestCartById(cartId);
      if (!cart) {
        const createdCart = await this.commandService.createGuestCart();
        return res.status(200).json({ id: createdCart.id, data: [] });
      }

      const items = await this.queryService.findGuestCartItems(cart.id);
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

  async addGuestItem(dto: AddGuestItemDto, res: Response): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() => this.commandService.addGuestItem(dto))
    );
  }

  async updateGuestItemQuantity(
    dto: UpdateItemQuantityDto,
    res: Response
  ): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() => this.commandService.updateGuestItemQuantity(dto))
    );
  }

  async deleteGuestItem(id: number, res: Response): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() => this.commandService.deleteGuestItem(id))
    );
  }

  async updateGuestSelectedItems(
    cartId: string,
    itemIds: number[],
    res: Response
  ): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() =>
        this.commandService.updateGuestSelectedItems(cartId, itemIds)
      )
    );
  }

  async updateGuestItemVariant(
    data: UpdateGuestItemVariantDto,
    res: Response
  ): Promise<Response> {
    return this.respond(
      res,
      await this.execute(() => this.commandService.updateGuestItemVariant(data))
    );
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
