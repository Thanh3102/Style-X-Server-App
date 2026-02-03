import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductModule } from '../product/product.module';
import { DiscountModule } from '../discount/discount.module';
import { CartModule } from '../cart/cart.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { MailModule } from '../mail/mail.module';
import { InventoriesModule } from '../inventories/inventories.module';

@Module({
  imports: [
    ProductModule,
    DiscountModule,
    CartModule,
    CloudinaryModule,
    MailModule,
    InventoriesModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, PrismaService],
  exports: [OrderService],
})
export class OrderModule {}
