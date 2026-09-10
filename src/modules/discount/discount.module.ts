import { Module } from '@nestjs/common';
import { DiscountController } from './discount.controller';
import { DiscountService } from './discount.service';
import { DiscountQueryService } from './services/discount-query.service';
import { DiscountExpirationService } from './services/discount-expiration.service';
import { DiscountCommandService } from './services/discount-command.service';
import { DiscountCalculationService } from './services/discount-calculation.service';

@Module({
  controllers: [DiscountController],
  providers: [
    DiscountService,
    DiscountQueryService,
    DiscountCommandService,
    DiscountCalculationService,
    DiscountExpirationService,
  ],
  exports: [DiscountService],
})
export class DiscountModule {}
