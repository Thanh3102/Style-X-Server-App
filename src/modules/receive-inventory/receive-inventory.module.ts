import { Module } from '@nestjs/common';
import { ReceiveInventoryController } from './receive-inventory.controller';
import { ReceiveInventoryService } from './receive-inventory.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ReceiveInventoryController],
  providers: [ReceiveInventoryService, PrismaService],
})
export class ReceiveInventoryModule {}
