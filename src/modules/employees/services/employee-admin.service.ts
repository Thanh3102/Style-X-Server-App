import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { hashPlainText } from 'src/utils/helper/bcryptHelper';
import { isInteger } from 'src/utils/helper/StringHelper';
import { PaginationData, QueryParams } from 'src/utils/types';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../employees.type';
import { EmployeeBasicInfo, employeeBasicInfoSelect } from '../employee.select';

export interface EmployeeListResult {
  employees: EmployeeBasicInfo[];
  paginition: PaginationData;
}

@Injectable()
export class EmployeeAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(params: QueryParams): Promise<EmployeeListResult> {
    const { page: pg, limit: lim, query, isEmployed, role } = params;
    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;

    const where: Prisma.EmployeeWhereInput = {
      void: false,
      id: {
        not: {
          in: [1, 2],
        },
      },
    };

    if (query) {
      where.OR = [
        { code: { startsWith: query.trim() } },
        { name: { startsWith: query.trim() } },
        { phoneNumber: { startsWith: query.trim() } },
        { email: { startsWith: query.trim() } },
      ];
    }

    if (isEmployed) {
      where.isEmployed = isEmployed === 'true';
    }

    if (role && isInteger(role)) {
      where.roleId = parseInt(role);
    }

    const userCount = await this.prisma.employee.count({ where });
    const employees = await this.prisma.employee.findMany({
      select: employeeBasicInfoSelect,
      where,
      skip: page === 1 ? 0 : limit * (page - 1),
      take: limit,
    });

    return {
      employees,
      paginition: {
        total: Math.floor(
          userCount % limit === 0 ? userCount / limit : userCount / limit + 1
        ),
        count: userCount,
        page,
        limit,
      },
    };
  }

  async createEmployee(
    dto: CreateEmployeeDto,
    createdEmployeeId: number
  ): Promise<void> {
    await this.checkCreateDuplicateEmployee(dto);
    const password = await hashPlainText(dto.email);
    const code = await generateCustomID('USER', 'employee');
    const dob = new Date(dto.dateOfBirth);
    const dateOfBirth = new Date(
      Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate())
    );

    await this.prisma.employee.create({
      data: {
        code,
        username: dto.email,
        password,
        name: dto.name,
        dateOfBirth,
        email: dto.email,
        gender: dto.gender === 1,
        phoneNumber: dto.phoneNumber,
        roleId: dto.roleId,
        createdEmployeeId,
      },
    });
  }

  async updateEmployee(dto: UpdateEmployeeDto): Promise<void> {
    await this.checkUpdateDuplicateEmployee(dto);

    const dob = new Date(dto.dateOfBirth);
    const dateOfBirth = new Date(
      Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate())
    );

    await this.prisma.employee.update({
      where: { id: dto.id },
      data: {
        name: dto.name,
        dateOfBirth,
        email: dto.email,
        gender: dto.gender === 1,
        phoneNumber: dto.phoneNumber,
        roleId: dto.roleId,
        isEmployed: dto.isEmployed,
      },
    });
  }

  async deleteEmployee(id: number): Promise<void> {
    await this.prisma.employee.update({
      where: { id },
      data: { void: true },
    });
  }

  private async checkCreateDuplicateEmployee(
    dto: CreateEmployeeDto
  ): Promise<void> {
    const existingEmail = await this.prisma.employee.findFirst({
      where: {
        email: dto.email,
        void: false,
      },
    });

    if (existingEmail) {
      throw new Error('Email đã tồn tại');
    }

    const existingPhone = await this.prisma.employee.findFirst({
      where: {
        phoneNumber: dto.phoneNumber,
        void: false,
      },
    });

    if (existingPhone) {
      throw new Error('Số điện thoại đã tồn tại');
    }
  }

  private async checkUpdateDuplicateEmployee(
    dto: UpdateEmployeeDto
  ): Promise<void> {
    const existingEmail = await this.prisma.employee.findFirst({
      where: {
        email: dto.email,
        id: { not: dto.id },
      },
    });

    if (existingEmail) {
      throw new Error('Email đã tồn tại');
    }

    const existingPhone = await this.prisma.employee.findFirst({
      where: {
        phoneNumber: dto.phoneNumber,
        id: { not: dto.id },
      },
    });

    if (existingPhone) {
      throw new Error('Số điện thoại đã tồn tại');
    }
  }
}
