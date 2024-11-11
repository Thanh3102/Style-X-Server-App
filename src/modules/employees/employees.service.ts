import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword } from 'src/utils/helper/bcryptHelper';
import { QueryParams } from 'src/utils/types';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private employeeBasicInfoSelect = {
    id: true,
    username: true,
    name: true,
    email: true,
    gender: true,
    dateOfBirth: true,
    createdAt: true,
    lastLoginAt: true,
    phoneNumber: true,
  };

  async getUsers(res: Response, params: QueryParams) {
    const { page: pg, limit: lim, query } = params;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 10;

    let queryCondition = {};

    if (query) {
      queryCondition = {
        OR: [
          {
            code: query,
          },
          {
            name: {
              startsWith: query,
            },
          },
        ],
      };
    }

    const whereCondition = {
      void: false,
      ...queryCondition,
    };

    const userCount = await this.prisma.employee.count({
      where: whereCondition,
    });

    const users = await this.prisma.employee.findMany({
      select: this.employeeBasicInfoSelect,
      where: whereCondition,
      skip: page === 1 ? 0 : limit * (page - 1),
      take: limit,
    });

    return res.status(200).json({
      users: users,
      paginition: {
        totalPage: Math.floor(
          userCount % limit === 0 ? userCount / limit : userCount / limit + 1,
        ),
        total: userCount,
        hasMore: page * limit < userCount,
      },
    });
  }

  async findById(employee_id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employee_id,
      },
      select: {
        password: true,
        ...this.employeeBasicInfoSelect,
      },
    });

    return employee;
  }

  async findByUsername(username: string) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        username: username,
      },
      select: {
        password: true,
        void: true,
        ...this.employeeBasicInfoSelect,
      },
    });

    return employee;
  }

  async updateLastLogin(employee_id: number) {
    await this.prisma.employee.update({
      data: {
        lastLoginAt: new Date(),
      },
      where: {
        id: employee_id,
      },
    });
  }

  async verifyUser(username: string, password: string) {
    const employee = await this.findByUsername(username);

    if (!employee || employee.void) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const isCorrectPW = await comparePassword(password, employee.password);

    if (!isCorrectPW) {
      throw new BadRequestException('Mật khẩu không chính xác');
    }

    return employee;
  }
}
