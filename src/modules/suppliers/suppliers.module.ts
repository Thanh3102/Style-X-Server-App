import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { TagsModule } from '../tags/tags.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [TagsModule, EmployeesModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
