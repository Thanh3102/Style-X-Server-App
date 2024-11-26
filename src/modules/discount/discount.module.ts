import { Module } from '@nestjs/common';
import { DiscountController } from './discount.controller';
import { DiscountService } from './discount.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [DiscountController],
  providers: [DiscountService, PrismaService],
  exports: [DiscountService]
})
export class DiscountModule {}
