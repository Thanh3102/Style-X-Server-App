import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductModule } from '../product/product.module';
import { DiscountModule } from '../discount/discount.module';
import { CartModule } from '../cart/cart.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { MailModule } from '../mail/mail.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { OrderCalculationService } from './services/order-calculation.service';
import { OrderCommandService } from './services/order-command.service';
import { OrderCronService } from './services/order-cron.service';
import { OrderInventoryService } from './services/order-inventory.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderQueryService } from './services/order-query.service';

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
  providers: [
    PrismaService,
    OrderCalculationService,
    OrderCommandService,
    OrderCronService,
    OrderInventoryService,
    OrderPaymentService,
    OrderQueryService,
  ],
  exports: [],
})
export class OrderModule {}
