import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InventoriesService } from '../inventories/inventories.service';
import { DiscountService } from '../discount/discount.service';

@Module({
  controllers: [CartController],
  providers: [
    CartService,
    PrismaService,
    ProductService,
    CloudinaryService,
    InventoriesService,
    DiscountService
  ],
  exports: [CartService],
})
export class CartModule {}
