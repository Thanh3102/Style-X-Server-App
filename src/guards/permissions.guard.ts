import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PERMISSIONS_KEY } from 'src/decorators/permission.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermissions = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();

    const userPermissions = await this.prisma.rolePermission
      .findMany({
        where: {
          role: {
            employees: {
              some: {
                id: user.id,
              },
            },
          },
        },
        select: {
          permission: {
            select: {
              name: true,
            },
          },
        },
      })
      .then((data) => data.map((item) => item.permission.name));

    const hasPermission = () =>
      userPermissions.some((permission) =>
        requiredPermissions.includes(permission),
      );
    if (!user || !hasPermission()) {
      throw new ForbiddenException('Không có quyền thực hiện');
    }
    return true;
  }
}
