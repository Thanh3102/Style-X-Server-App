import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { DiscountService } from '../discount/discount.service';
import { CartService } from '../cart/cart.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MailService } from '../mail/mail.service';
import { InventoriesService } from '../inventories/inventories.service';

@Module({
  controllers: [OrderController],
  providers: [
    OrderService,
    PrismaService,
    ProductService,
    DiscountService,
    CartService,
    CloudinaryService,
    MailService,
    InventoriesService,
  ],
  exports: [OrderService],
})
export class OrderModule {}
