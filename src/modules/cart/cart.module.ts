import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductModule } from '../product/product.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { DiscountModule } from '../discount/discount.module';

@Module({
  imports: [ProductModule, CloudinaryModule, InventoriesModule, DiscountModule],
  controllers: [CartController],
  providers: [CartService, PrismaService],
  exports: [CartService],
})
export class CartModule {}
