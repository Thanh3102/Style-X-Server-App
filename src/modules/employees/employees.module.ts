import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeAccountService } from './services/employee-account.service';
import { EmployeeAdminService } from './services/employee-admin.service';
import { RolePermissionService } from './services/role-permission.service';

@Module({
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeeAccountService,
    EmployeeAdminService,
    RolePermissionService,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule {}
