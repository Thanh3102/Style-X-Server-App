import { Injectable } from '@nestjs/common';
import {
  AddGuestItemDto,
  AddItemDto,
  UpdateItemQuantityDto,
} from './cart.type';
import { Response } from 'express';
import { CartGuestService } from './services/cart-guest.service';
import { CartCustomerService } from './services/cart-customer.service';

@Injectable()
export class CartService {
  constructor(
    private guestCartService: CartGuestService,
    private customerCartService: CartCustomerService
  ) {}

  async syncCart(
    guestCartId: string | null,
    req,
    res: Response
  ): Promise<Response> {
    return this.customerCartService.syncCart(guestCartId, req, res);
  }

  async addItem(dto: AddItemDto, req, res: Response): Promise<Response> {
    return this.customerCartService.addItem(dto, req, res);
  }

  async addGuestItem(dto: AddGuestItemDto, res: Response): Promise<Response> {
    return this.guestCartService.addGuestItem(dto, res);
  }

  async updateItemQuantity(
    dto: UpdateItemQuantityDto,
    res: Response
  ): Promise<Response> {
    return this.customerCartService.updateItemQuantity(dto, res);
  }

  async deleteItem(id: number, res: Response): Promise<Response> {
    return this.customerCartService.deleteItem(id, res);
  }

  async getItems(req, res: Response): Promise<Response> {
    return this.customerCartService.getItems(req, res);
  }

  async getGuestItems(cartId: string | null, res: Response) {
    return this.guestCartService.getGuestItems(cartId, res);
  }

  async updateGuestItemQuantity(dto: UpdateItemQuantityDto, res: Response) {
    return this.guestCartService.updateGuestItemQuantity(dto, res);
  }

  async deleteGuestItem(id: number, res: Response) {
    return this.guestCartService.deleteGuestItem(id, res);
  }

  async updateGuestSelectedItems(
    cartId: string,
    itemIds: number[],
    res: Response
  ) {
    return this.guestCartService.updateGuestSelectedItems(cartId, itemIds, res);
  }

  async updateSelectedItems(itemIds: number[], req, res: Response) {
    return this.customerCartService.updateSelectedItems(itemIds, req, res);
  }

  async updateItemVariant(
    itemId: number,
    newVariantId: number,
    req,
    res: Response
  ) {
    return this.customerCartService.updateItemVariant(
      itemId,
      newVariantId,
      req,
      res
    );
  }

  async updateGuestItemVariant(
    data: {
      itemId: number;
      newVariantId: number;
      cartId: string;
    },
    res: Response
  ) {
    return this.guestCartService.updateGuestItemVariant(data, res);
  }
}
