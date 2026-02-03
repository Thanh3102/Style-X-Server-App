import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TagsModule } from '../tags/tags.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [TagsModule, EmployeesModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, PrismaService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
