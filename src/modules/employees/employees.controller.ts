import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtGuard } from 'src/guards/jwt.guard';
import {
  EmployeePermission,
  QueryParams,
  RolePermission,
} from 'src/utils/types';
import { Response } from 'express';
import {
  CreateEmployeeDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateEmployeeDto,
} from './employees.dto';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { Permissions } from 'src/decorators/permission.decorator';

@UseGuards(JwtGuard, PermissionsGuard)
@Controller('employee')
export class EmployeesController {
  constructor(private employeeService: EmployeesService) {}

  @Get('/current-permission')
  getCurrentPermissions(@Req() req, @Res() res) {
    return this.employeeService.getCurrentPermissions(req, res);
  }

  @Get('/')
  getUsers(@Query() queryParams: QueryParams, @Res() res) {
    return this.employeeService.getUsers(res, queryParams);
  }

  @Get('/roles')
  // @Permissions(RolePermission.Access)
  getRoles(@Res() res: Response) {
    return this.employeeService.getRoles(res);
  }

  @Get('/permissions')
  getPermission(@Res() res) {
    return this.employeeService.getPermissions(res);
  }

  @Post('/roles')
  @Permissions(RolePermission.Create)
  createRole(@Body() dto: CreateRoleDto, @Req() req, @Res() res) {
    return this.employeeService.createRole(dto, req, res);
  }

  @Put('/roles')
  @Permissions(RolePermission.Update)
  updateRole(@Body() dto: UpdateRoleDto, @Res() res) {
    return this.employeeService.updateRole(dto, res);
  }

  @Delete('/roles/:roleId')
  @Permissions(RolePermission.Delete)
  deleteRole(@Param('roleId') roleId: string, @Res() res) {
    return this.employeeService.deleteRole(parseInt(roleId), res);
  }

  @Post('/')
  @Permissions(EmployeePermission.Create)
  createEmployee(@Body() dto: CreateEmployeeDto, @Req() req, @Res() res) {
    return this.employeeService.createEmployee(dto, req, res);
  }

  @Put('/')
  @Permissions(EmployeePermission.Update)
  updateEmployee(@Body() dto: UpdateEmployeeDto, @Res() res) {
    return this.employeeService.updateEmployee(dto, res);
  }

  @Delete('/:employeeId')
  @Permissions(EmployeePermission.Delete)
  deleteEmployee(@Param('employeeId') employeeId: string, @Res() res) {
    return this.employeeService.deleteEmployee(parseInt(employeeId), res);
  }

  @Get('/me')
  getMe(@Req() req, @Res() res) {
    return this.employeeService.getMe(req, res);
  }

  @Put('/change-password')
  changePassword(
    @Body() dto: { oldPassword: string; newPassword: string },
    @Req() req,
    @Res() res,
  ) {
    return this.employeeService.changePassword(dto, req, res);
  }
}
