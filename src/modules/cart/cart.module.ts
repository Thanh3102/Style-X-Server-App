import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ProductModule } from '../product/product.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { DiscountModule } from '../discount/discount.module';
import { CartGuestService } from './services/cart-guest.service';
import { CartCustomerService } from './services/cart-customer.service';
import { CartCheckoutService } from './services/cart-checkout.service';
import { CartCustomerCommandService } from './services/cart-customer-command.service';
import { CartCustomerQueryService } from './services/cart-customer-query.service';
import { CartExpirationService } from './services/cart-expiration.service';
import { CartGuestCommandService } from './services/cart-guest-command.service';
import { CartGuestQueryService } from './services/cart-guest-query.service';
import { CartPricingService } from './services/cart-pricing.service';
import { CartStockPolicy } from './services/cart-stock-policy.service';
import { CartSyncService } from './services/cart-sync.service';

@Module({
  imports: [ProductModule, CloudinaryModule, InventoriesModule, DiscountModule],
  controllers: [CartController],
  providers: [
    CartService,
    CartGuestService,
    CartCustomerService,
    CartCheckoutService,
    CartCustomerCommandService,
    CartCustomerQueryService,
    CartExpirationService,
    CartGuestCommandService,
    CartGuestQueryService,
    CartPricingService,
    CartStockPolicy,
    CartSyncService,
  ],
  exports: [
    CartService,
    CartGuestService,
    CartCustomerService,
    CartCheckoutService,
  ],
})
export class CartModule {}
