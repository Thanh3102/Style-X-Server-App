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
import { GuestCartService } from './services/guest-cart.service';
import { CustomerCartService } from './services/customer-cart.service';

@Module({
  imports: [ProductModule, CloudinaryModule, InventoriesModule, DiscountModule],
  controllers: [CartController],
  providers: [
    CartService,
    PrismaService,
    GuestCartService,
    CustomerCartService,
    ProductQueryService,
    ProductInventoryService,
  ],
  exports: [CartService, GuestCartService, CustomerCartService],
})
export class CartModule {}
