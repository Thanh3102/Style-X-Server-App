import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import { AuthenticatedRequest, QueryParams } from 'src/utils/types';
import { EmployeeWithPassword, EmployeeWithVoid } from './employee.select';
import {
  CreateEmployeeDto,
  CreateRoleDto,
  UpdateEmployeeDto,
  UpdateRoleDto,
} from './employees.type';
import { EmployeeAccountService } from './services/employee-account.service';
import { EmployeeAdminService } from './services/employee-admin.service';
import { RolePermissionService } from './services/role-permission.service';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly accountService: EmployeeAccountService,
    private readonly adminService: EmployeeAdminService,
    private readonly rolePermissionService: RolePermissionService
  ) {}

  async getUsers(res: Response, params: QueryParams): Promise<Response> {
    return res.status(200).json(await this.adminService.getUsers(params));
  }

  findById(employeeId: number): Promise<EmployeeWithPassword | null> {
    return this.accountService.findById(employeeId);
  }

  findByUsername(username: string): Promise<EmployeeWithVoid | null> {
    return this.accountService.findByUsername(username);
  }

  updateLastLogin(employeeId: number): Promise<void> {
    return this.accountService.updateLastLogin(employeeId);
  }

  verifyUser(username: string, password: string): Promise<EmployeeWithVoid> {
    return this.accountService.verifyUser(username, password);
  }

  async getRoles(res: Response): Promise<Response> {
    try {
      return res.status(200).json(await this.rolePermissionService.getRoles());
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getPermissions(res: Response): Promise<Response> {
    try {
      return res
        .status(200)
        .json(await this.rolePermissionService.getPermissions());
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async createRole(
    dto: CreateRoleDto,
    _req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.rolePermissionService.createRole(dto);
      return res.status(200).json({ message: 'Thêm vai trò mới thành công' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async updateRole(dto: UpdateRoleDto, res: Response): Promise<Response> {
    try {
      await this.rolePermissionService.updateRole(dto);
      return res.status(200).json({ message: 'Cập nhật vai trò thành công' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async deleteRole(roleId: number, res: Response): Promise<Response> {
    try {
      await this.rolePermissionService.deleteRole(roleId);
      return res.status(200).json({ message: 'Đã xóa vai trò' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async createEmployee(
    dto: CreateEmployeeDto,
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.adminService.createEmployee(
        dto,
        parseInt(String(req.user.id))
      );
      return res.status(200).json({ message: 'Thêm nhân viên thành công' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async updateEmployee(
    dto: UpdateEmployeeDto,
    res: Response
  ): Promise<Response> {
    try {
      await this.adminService.updateEmployee(dto);
      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async deleteEmployee(id: number, res: Response): Promise<Response> {
    try {
      await this.adminService.deleteEmployee(id);
      return res.status(200).json({ message: 'Đã xóa nhân viên' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const employee = await this.accountService.getMe(
        parseInt(String(req.user.id))
      );
      return res.status(200).json(employee);
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async changePassword(
    dto: { oldPassword: string; newPassword: string },
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      await this.accountService.changePassword(
        req.user.id as number,
        dto.oldPassword,
        dto.newPassword
      );
      return res.status(200).json({ message: 'Đã cập nhật mật khẩu' });
    } catch (error: unknown) {
      return this.internalServerError(res, error);
    }
  }

  async getCurrentPermissions(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response> {
    try {
      const permissions = await this.accountService.getCurrentPermissions(
        parseInt(String(req.user.id))
      );
      return res.status(200).json(permissions);
    } catch (error: unknown) {
      this.logError(error);
      return res.status(200).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  private internalServerError(res: Response, error: unknown): Response {
    this.logError(error);
    return res.status(500).json({ message: getErrorMessage(error) });
  }

  private logError(error: unknown): void {
    this.logger.error(getErrorMessage(error), getErrorStack(error));
  }
}
