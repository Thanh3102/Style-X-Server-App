import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TagsService } from '../tags/tags.service';
import { EmployeesService } from '../employees/employees.service';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, PrismaService, TagsService, EmployeesService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
