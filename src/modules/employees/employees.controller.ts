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
import { QueryParams } from 'src/utils/types';
import { Response } from 'express';
import {
  CreateEmployeeDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateEmployeeDto,
} from './employees.dto';

@UseGuards(JwtGuard)
@Controller('employee')
export class EmployeesController {
  constructor(private employeeService: EmployeesService) {}

  @Get('/')
  getUsers(@Query() queryParams: QueryParams, @Res() res) {
    return this.employeeService.getUsers(res, queryParams);
  }

  @Get('/roles')
  getRoles(@Res() res: Response) {
    return this.employeeService.getRoles(res);
  }

  @Get('/permissions')
  getPermission(@Res() res) {
    return this.employeeService.getPermissions(res);
  }

  @Post('/roles')
  createRole(@Body() dto: CreateRoleDto, @Req() req, @Res() res) {
    return this.employeeService.createRole(dto, req, res);
  }

  @Put('/roles')
  updateRole(@Body() dto: UpdateRoleDto, @Res() res) {
    return this.employeeService.updateRole(dto, res);
  }

  @Delete('/roles/:roleId')
  deleteRole(@Param('roleId') roleId: string, @Res() res) {
    return this.employeeService.deleteRole(parseInt(roleId), res);
  }

  @Post('/')
  createEmployee(@Body() dto: CreateEmployeeDto, @Req() req, @Res() res) {
    return this.employeeService.createEmployee(dto, req, res);
  }

  @Put('/')
  updateEmployee(@Body() dto: UpdateEmployeeDto, @Res() res) {
    return this.employeeService.updateEmployee(dto, res);
  }

  @Delete('/:employeeId')
  deleteEmployee(@Param('employeeId') employeeId: string, @Res() res) {
    return this.employeeService.deleteEmployee(parseInt(employeeId), res);
  }

  @Get('/me')
  getMe(@Req() req, @Res() res) {
    return this.employeeService.getMe(req, res);
  }

  @Put("/change-password")
  changePassword(@Body() dto: { oldPassword: string, newPassword: string }, @Req() req, @Res() res) {
    return this.employeeService.changePassword(dto, req, res);
  }
}
