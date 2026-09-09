import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { TagsModule } from '../tags/tags.module';
import { EmployeesModule } from '../employees/employees.module';
import { SupplierCommandService } from './services/supplier-command.service';
import { SupplierQueryService } from './services/supplier-query.service';
import { SupplierValidationService } from './services/supplier-validation.service';

@Module({
  imports: [TagsModule, EmployeesModule],
  controllers: [SuppliersController],
  providers: [
    SuppliersService,
    SupplierCommandService,
    SupplierQueryService,
    SupplierValidationService,
  ],
  exports: [SuppliersService],
})
export class SuppliersModule {}
