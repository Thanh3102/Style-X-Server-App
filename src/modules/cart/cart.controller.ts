import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from 'src/guards/jwt.guard';
import { LoggerInterceptor } from 'src/interceptors/logging.interceptor';
import {
  AddGuestItemDto,
  AddItemDto,
  SyncCartDto,
  UpdateGuestItemVariantDto,
  UpdateGuestSelectedItemsDto,
  UpdateItemQuantityDto,
  UpdateItemVariantDto,
  UpdateSelectedItemsDto,
} from './cart.dto';
import { CartService } from './cart.service';
import { isInteger } from 'src/utils/helper/StringHelper';
import { Public } from 'src/decorators/Public.decorator';
import { Response } from 'express';

@UseGuards(JwtGuard)
@UseInterceptors(LoggerInterceptor)
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Public()
  @Get('/guest')
  getGuestItems(@Query('cartId') cartId: string | undefined, @Res() res) {
    return this.cartService.getGuestItems(cartId, res);
  }

  @Public()
  @Post('/guest')
  addGuestItem(@Body() dto: AddGuestItemDto, @Res() res) {
    return this.cartService.addGuestItem(dto, res);
  }

  @Public()
  @Put('/guest')
  updateGuestItemQuantity(@Body() dto: UpdateItemQuantityDto, @Res() res) {
    return this.cartService.updateGuestItemQuantity(dto, res);
  }

  @Public()
  @Put('/guest/select')
  updateGuestSelectedItems(
    @Body() dto: UpdateGuestSelectedItemsDto,
    @Res() res,
  ) {
    return this.cartService.updateGuestSelectedItems(
      dto.cartId,
      dto.itemIds,
      res,
    );
  }

  @Public()
  @Put('/guest/variant')
  updateGuestItemVariant(@Body() dto: UpdateGuestItemVariantDto, @Res() res) {
    return this.cartService.updateGuestItemVariant(
      {
        cartId: dto.cartId,
        itemId: dto.itemId,
        newVariantId: dto.newVariantId,
      },
      res,
    );
  }

  @Put('/select')
  updateSelectedItems(
    @Body() dto: UpdateSelectedItemsDto,
    @Req() req,
    @Res() res,
  ) {
    return this.cartService.updateSelectedItems(dto.itemIds, req, res);
  }

  @Public()
  @Delete('/guest/:id')
  deleteGuestItem(@Param('id') id: string, @Res() res) {
    if (!isInteger(id))
      return res.status(400).json({ message: 'Mã không hợp lệ' });
    return this.cartService.deleteGuestItem(parseInt(id), res);
  }

  @Get('/')
  getItems(@Req() req, @Res() res) {
    return this.cartService.getItems(req, res);
  }

  @Post('/')
  addItem(@Body() dto: AddItemDto, @Req() req, @Res() res) {
    return this.cartService.addItem(dto, req, res);
  }

  @Put('/')
  updateItemQuantity(@Body() dto: UpdateItemQuantityDto, @Res() res) {
    return this.cartService.updateItemQuantity(dto, res);
  }

  @Put('/variant')
  updateItemVariant(@Body() dto: UpdateItemVariantDto, @Req() req, @Res() res) {
    return this.cartService.updateItemVariant(
      dto.itemId,
      dto.newVariantId,
      req,
      res,
    );
  }

  @Delete('/:id')
  deleteItem(@Param('id') id: string, @Res() res) {
    if (!isInteger(id))
      return res.status(400).json({ message: 'Mã không hợp lệ' });
    return this.cartService.deleteItem(parseInt(id), res);
  }

  @Post('/sync')
  syncCart(@Body() dto: SyncCartDto, @Req() req, @Res() res: Response) {
    return this.cartService.syncCart(dto.guestCartId, req, res);
  }
}
