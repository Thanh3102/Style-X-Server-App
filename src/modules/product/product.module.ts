import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InventoriesService } from '../inventories/inventories.service';
import { DiscountService } from '../discount/discount.service';

@Module({
  controllers: [ProductController],
  providers: [
    ProductService,
    PrismaService,
    CloudinaryService,
    InventoriesService,
    DiscountService
  ],
  exports: [ProductService],
})
export class ProductModule {}
