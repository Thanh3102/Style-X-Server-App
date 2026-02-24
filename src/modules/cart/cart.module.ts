import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductModule } from '../product/product.module';
import { ProductQueryService } from '../product/services/product-query.service';
import { ProductInventoryService } from '../product/services/product-inventory.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { DiscountModule } from '../discount/discount.module';
import { CartGuestService } from './services/cart-guest.service';
import { CartCustomerService } from './services/cart-customer.service';

@Module({
  imports: [ProductModule, CloudinaryModule, InventoriesModule, DiscountModule],
  controllers: [CartController],
  providers: [
    CartService,
    PrismaService,
    CartGuestService,
    CartCustomerService,
    ProductQueryService,
    ProductInventoryService,
  ],
  exports: [CartService, CartGuestService, CartCustomerService],
})
export class CartModule {}
