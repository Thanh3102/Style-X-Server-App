import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword, hashPlainText } from 'src/utils/helper/bcryptHelper';
import { QueryParams } from 'src/utils/types';
import {
  CreateEmployeeDto,
  CreateRoleDto,
  UpdateEmployeeDto,
  UpdateRoleDto,
} from './employees.type';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { Prisma } from '@prisma/client';
import { isInteger } from 'src/utils/helper/StringHelper';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private employeeBasicInfoSelect: Prisma.EmployeeSelect = {
    id: true,
    code: true,
    username: true,
    name: true,
    email: true,
    gender: true,
    dateOfBirth: true,
    createdAt: true,
    lastLoginAt: true,
    phoneNumber: true,
    isEmployed: true,
    roleId: true,
  };

  async getUsers(res: Response, params: QueryParams) {
    const { page: pg, limit: lim, query, isEmployed, role } = params;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;

    let whereCondition: Prisma.EmployeeWhereInput = {
      void: false,
      id: {
        not: {
          in: [1, 2],
        },
      },
    };

    if (query) {
      whereCondition = {
        ...whereCondition,
        OR: [
          {
            code: {
              startsWith: query.trim(),
            },
          },
          {
            name: {
              startsWith: query.trim(),
            },
          },
          {
            phoneNumber: {
              startsWith: query.trim(),
            },
          },
          {
            email: {
              startsWith: query.trim(),
            },
          },
        ],
      };
    }

    if (isEmployed) {
      whereCondition.isEmployed = isEmployed === 'true';
    }

    if (role && isInteger(role)) {
      whereCondition.roleId = parseInt(role);
    }

    const userCount = await this.prisma.employee.count({
      where: whereCondition,
    });

    const employees = await this.prisma.employee.findMany({
      select: this.employeeBasicInfoSelect,
      where: whereCondition,
      skip: page === 1 ? 0 : limit * (page - 1),
      take: limit,
    });

    return res.status(200).json({
      employees: employees,
      paginition: {
        total: Math.floor(
          userCount % limit === 0 ? userCount / limit : userCount / limit + 1,
        ),
        count: userCount,
        page: page,
        limit: limit,
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
    const employee = await this.prisma.employee.findFirst({
      where: {
        username: username,
        void: false,
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

  async getRoles(res: Response) {
    try {
      const roles = await this.prisma.role.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          isEditable: true,
          isDeletable: true,
          rolePermissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          employees: {
            select: {
              id: true,
              name: true,
            },
            where: {
              void: false,
            },
          },
          _count: {
            select: {
              employees: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
        where: {
          void: false,
        },
      });

      const tranformRoles = roles.map((role) => {
        const { rolePermissions, ...data } = role;
        const permissions = rolePermissions.map((item) => item.permission);
        return { ...data, permissions };
      });

      return res.status(200).json(tranformRoles);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: error.message ?? 'Đã xảy ra lỗi',
      });
    }
  }

  async getPermissions(res: Response) {
    try {
      const permissionSections = await this.prisma.permissionSection.findMany({
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
      });

      return res.status(200).json(permissionSections);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: error.message ?? 'Đã xảy ra lỗi',
      });
    }
  }

  async createRole(dto: CreateRoleDto, req, res) {
    try {
      const existRole = await this.prisma.role.findFirst({
        where: {
          name: dto.name,
        },
      });

      if (existRole) throw new Error('Tên vai trò đã tồn tại');

      await this.prisma.role.create({
        data: {
          isDeletable: true,
          isEditable: true,
          name: dto.name,
          rolePermissions: {
            createMany: {
              data: dto.permissionIds.map((id) => ({ permissionId: id })),
            },
          },
        },
      });

      return res.status(200).json({ message: 'Thêm vai trò mới thành công' });
    } catch (error) {
      console.log(error);

      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async updateRole(dto: UpdateRoleDto, res) {
    try {
      await this.prisma.$transaction(async (p) => {
        const existRole = await p.role.findFirst({
          where: {
            name: dto.name,
            id: {
              not: dto.id,
            },
          },
        });

        if (existRole) throw new Error('Tên vai trò đã tồn tại');

        const currentPermissionIds = await p.rolePermission
          .findMany({
            where: {
              roleId: dto.id,
            },
            select: {
              permissionId: true,
            },
          })
          .then((data) => data.map((item) => item.permissionId));

        const addPermissionIds = dto.permissionIds.filter(
          (id) => !currentPermissionIds.includes(id),
        );

        const deletePermissionIds = currentPermissionIds.filter(
          (id) => !dto.permissionIds.includes(id),
        );

        if (addPermissionIds.length > 0) {
          await p.rolePermission.createMany({
            data: addPermissionIds.map((id) => ({
              permissionId: id,
              roleId: dto.id,
            })),
          });
        }

        if (deletePermissionIds.length > 0) {
          await p.rolePermission.deleteMany({
            where: {
              roleId: dto.id,
              permissionId: {
                in: deletePermissionIds,
              },
            },
          });
        }
      });

      return res.status(200).json({ message: 'Cập nhật vai trò thành công' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async deleteRole(roleId: number, res) {
    try {
      const countEmployee = await this.prisma.employee.count({
        where: {
          roleId: roleId,
          void: false,
        },
      });

      if (countEmployee > 0)
        throw new BadRequestException(
          'Không thể xóa do có nhân viên thuộc vai trò này',
        );

      await this.prisma.role.update({
        where: {
          id: roleId,
        },
        data: {
          void: true,
        },
      });

      return res.status(200).json({ message: 'Đã xóa vai trò' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async checkCreateDuplicateEmployee(dto: CreateEmployeeDto) {
    const existEmail = await this.prisma.employee.findFirst({
      where: {
        email: dto.email,
        void: false,
      },
    });

    if (existEmail) throw new Error('Email đã tồn tại');

    const existPhone = await this.prisma.employee.findFirst({
      where: {
        phoneNumber: dto.phoneNumber,
        void: false,
      },
    });

    if (existPhone) throw new Error('Số điện thoại đã tồn tại');
  }

  async checkUpdateDuplicateEmployee(dto: UpdateEmployeeDto) {
    const existEmail = await this.prisma.employee.findFirst({
      where: {
        email: dto.email,
        id: {
          not: dto.id,
        },
      },
    });

    if (existEmail) throw new Error('Email đã tồn tại');

    const existPhone = await this.prisma.employee.findFirst({
      where: {
        phoneNumber: dto.phoneNumber,
        id: {
          not: dto.id,
        },
      },
    });

    if (existPhone) throw new Error('Số điện thoại đã tồn tại');
  }

  async createEmployee(dto: CreateEmployeeDto, req, res: Response) {
    try {
      await this.checkCreateDuplicateEmployee(dto);
      const hashPW = await hashPlainText(dto.email);
      const code = await generateCustomID('USER', 'employee');
      const dob = new Date(dto.dateOfBirth);
      const dateOfBirth = new Date(
        Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate()),
      );

      await this.prisma.employee.create({
        data: {
          code: code,
          username: dto.email,
          password: hashPW,
          name: dto.name,
          dateOfBirth: dateOfBirth,
          email: dto.email,
          gender: dto.gender === 1 ? true : false,
          phoneNumber: dto.phoneNumber,
          roleId: dto.roleId,
          createdEmployeeId: req.user.id,
        },
      });

      return res.status(200).json({ message: 'Thêm nhân viên thành công' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async updateEmployee(dto: UpdateEmployeeDto, res) {
    try {
      await this.checkUpdateDuplicateEmployee(dto);
      const dob = new Date(dto.dateOfBirth);
      const dateOfBirth = new Date(
        Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate()),
      );

      await this.prisma.employee.update({
        where: {
          id: dto.id,
        },
        data: {
          name: dto.name,
          dateOfBirth: dateOfBirth,
          email: dto.email,
          gender: dto.gender === 1 ? true : false,
          phoneNumber: dto.phoneNumber,
          roleId: dto.roleId,
          isEmployed: dto.isEmployed,
        },
      });

      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async deleteEmployee(id: number, res: Response) {
    try {
      await this.prisma.employee.update({
        where: {
          id: id,
        },
        data: {
          void: true,
        },
      });

      return res.status(200).json({ message: 'Đã xóa nhân viên' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getMe(req, res: Response) {
    try {
      const id = req.user.id;
      const employee = await this.prisma.employee.findUnique({
        where: {
          id: id,
        },
        select: this.employeeBasicInfoSelect,
      });
      return res.status(200).json(employee);
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async changePassword(
    dto: { oldPassword: string; newPassword: string },
    req,
    res: Response,
  ) {
    const { oldPassword, newPassword } = dto;
    try {
      const employee = await this.findById(req.user.id);

      const isCorrectPW = await comparePassword(oldPassword, employee.password);

      if (!isCorrectPW) {
        throw new BadRequestException('Mật khẩu cũ không chính xác');
      }

      const hashPW = await hashPlainText(newPassword);

      await this.prisma.employee.update({
        where: {
          id: req.user.id,
        },
        data: {
          password: hashPW,
        },
      });

      return res.status(200).json({ message: 'Đã cập nhật mật khẩu' });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getCurrentPermissions(req, res: Response) {
    try {
      const employee = await this.prisma.employee.findUnique({
        where: {
          id: req.user.id,
        },
        select: {
          role: {
            select: {
              rolePermissions: {
                select: {
                  permission: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!employee) throw new BadRequestException('User not found');

      const permissions = [];
      for (const perm of employee.role.rolePermissions) {
        permissions.push(perm.permission.name);
      }

      return res.status(200).json(permissions);
    } catch (error) {
      console.log(error);
      return res.status(200).json({ message: 'Đã xảy ra lỗi' });
    }
  }
}
