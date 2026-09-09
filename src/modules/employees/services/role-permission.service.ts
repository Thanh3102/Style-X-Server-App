import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from '../employees.type';

const roleSelect = {
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
} satisfies Prisma.RoleSelect;

type RoleRecord = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

export type RoleResult = Omit<RoleRecord, 'rolePermissions'> & {
  permissions: RoleRecord['rolePermissions'][number]['permission'][];
};

const permissionSectionSelect = {
  id: true,
  name: true,
  permissions: {
    select: {
      id: true,
      name: true,
      displayName: true,
    },
  },
} satisfies Prisma.PermissionSectionSelect;

export type PermissionSectionResult = Prisma.PermissionSectionGetPayload<{
  select: typeof permissionSectionSelect;
}>;

@Injectable()
export class RolePermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoles(): Promise<RoleResult[]> {
    const roles = await this.prisma.role.findMany({
      select: roleSelect,
      orderBy: {
        name: 'asc',
      },
      where: {
        void: false,
      },
    });

    return roles.map(({ rolePermissions, ...role }) => ({
      ...role,
      permissions: rolePermissions.map(({ permission }) => permission),
    }));
  }

  async getPermissions(): Promise<PermissionSectionResult[]> {
    return this.prisma.permissionSection.findMany({
      select: permissionSectionSelect,
      orderBy: {
        id: 'asc',
      },
    });
  }

  async createRole(dto: CreateRoleDto): Promise<void> {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        name: dto.name,
      },
    });

    if (existingRole) {
      throw new Error('Tên vai trò đã tồn tại');
    }

    await this.prisma.role.create({
      data: {
        isDeletable: true,
        isEditable: true,
        name: dto.name,
        rolePermissions: {
          createMany: {
            data: dto.permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
      },
    });
  }

  async updateRole(dto: UpdateRoleDto): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const existingRole = await transaction.role.findFirst({
        where: {
          name: dto.name,
          id: {
            not: dto.id,
          },
        },
      });

      if (existingRole) {
        throw new Error('Tên vai trò đã tồn tại');
      }

      const currentPermissionIds = await transaction.rolePermission
        .findMany({
          where: {
            roleId: dto.id,
          },
          select: {
            permissionId: true,
          },
        })
        .then((records) => records.map(({ permissionId }) => permissionId));

      const permissionIdsToAdd = dto.permissionIds.filter(
        (id) => !currentPermissionIds.includes(id)
      );
      const permissionIdsToDelete = currentPermissionIds.filter(
        (id) => !dto.permissionIds.includes(id)
      );

      if (permissionIdsToAdd.length > 0) {
        await transaction.rolePermission.createMany({
          data: permissionIdsToAdd.map((permissionId) => ({
            permissionId,
            roleId: dto.id,
          })),
        });
      }

      if (permissionIdsToDelete.length > 0) {
        await transaction.rolePermission.deleteMany({
          where: {
            roleId: dto.id,
            permissionId: {
              in: permissionIdsToDelete,
            },
          },
        });
      }
    });
  }

  async deleteRole(roleId: number): Promise<void> {
    const employeeCount = await this.prisma.employee.count({
      where: {
        roleId,
        void: false,
      },
    });

    if (employeeCount > 0) {
      throw new BadRequestException(
        'Không thể xóa do có nhân viên thuộc vai trò này'
      );
    }

    await this.prisma.role.update({
      where: {
        id: roleId,
      },
      data: {
        void: true,
      },
    });
  }
}
