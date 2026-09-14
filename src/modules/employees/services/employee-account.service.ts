import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword, hashPlainText } from 'src/utils/helper/bcryptHelper';
import {
  EmployeeBasicInfo,
  EmployeeWithPassword,
  EmployeeWithVoid,
  employeeBasicInfoSelect,
  employeeWithPasswordSelect,
  employeeWithVoidSelect,
} from '../employee.select';

@Injectable()
export class EmployeeAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(employeeId: number): Promise<EmployeeWithPassword | null> {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: employeeWithPasswordSelect,
    });
  }

  async findByUsername(username: string): Promise<EmployeeWithVoid | null> {
    return this.prisma.employee.findFirst({
      where: {
        username,
        void: false,
      },
      select: employeeWithVoidSelect,
    });
  }

  async updateLastLogin(employeeId: number): Promise<void> {
    await this.prisma.employee.update({
      data: { lastLoginAt: new Date() },
      where: { id: employeeId },
    });
  }

  async verifyUser(
    username: string,
    password: string
  ): Promise<EmployeeWithVoid> {
    const employee = await this.findByUsername(username);

    if (!employee || employee.void) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const isCorrectPassword = await comparePassword(
      password,
      employee.password
    );

    if (!isCorrectPassword) {
      throw new BadRequestException('Mật khẩu không chính xác');
    }

    await this.updateLastLogin(employee.id);
    return employee;
  }

  async getMe(employeeId: number): Promise<EmployeeBasicInfo | null> {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: employeeBasicInfoSelect,
    });
  }

  async changePassword(
    employeeId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const employee = await this.findById(employeeId);
    const isCorrectPassword = await comparePassword(
      oldPassword,
      employee.password
    );

    if (!isCorrectPassword) {
      throw new BadRequestException('Mật khẩu cũ không chính xác');
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { password: await hashPlainText(newPassword) },
    });
  }

  async getCurrentPermissions(employeeId: number): Promise<string[]> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) {
      throw new BadRequestException('User not found');
    }

    return employee.role.rolePermissions.map(
      ({ permission }) => permission.name
    );
  }
}
