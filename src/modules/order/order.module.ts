import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
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
import { OrderCancellationService } from './services/order-cancellation.service';
import { OrderCheckoutService } from './services/order-checkout.service';
import { OrderFulfillmentService } from './services/order-fulfillment.service';
import { OrderPayOsGatewayService } from './services/order-pay-os-gateway.service';
import { OrderResponseMapper } from './services/order-response-mapper.service';
import { OrderVoucherPolicyService } from './services/order-voucher-policy.service';
import { OrderVoucherApplicationService } from './services/order-voucher-application.service';
import { OrderTemporaryCreationService } from './services/order-temporary-creation.service';
import { OrderNotificationService } from './services/order-notification.service';

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
    OrderCalculationService,
    OrderCommandService,
    OrderCronService,
    OrderInventoryService,
    OrderPaymentService,
    OrderQueryService,
    OrderCancellationService,
    OrderCheckoutService,
    OrderFulfillmentService,
    OrderPayOsGatewayService,
    OrderResponseMapper,
    OrderVoucherPolicyService,
    OrderVoucherApplicationService,
    OrderTemporaryCreationService,
    OrderNotificationService,
  ],
  exports: [],
})
export class OrderModule {}
