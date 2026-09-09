import { Module } from '@nestjs/common';
import { DiscountController } from './discount.controller';
import { DiscountService } from './discount.service';
import { DiscountQueryService } from './services/discount-query.service';
import { DiscountExpirationService } from './services/discount-expiration.service';

@Module({
  controllers: [DiscountController],
  providers: [DiscountService, DiscountQueryService, DiscountExpirationService],
  exports: [DiscountService],
})
export class DiscountModule {}
