import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { isInteger } from 'src/utils/helper/StringHelper';
import { CheckCodeOptions } from '../suppliers.type';

@Injectable()
export class SupplierValidationService {
  private readonly codePrefix = 'SUP';

  constructor(private readonly prisma: PrismaService) {}

  async checkCode(
    code: string | undefined,
    options: CheckCodeOptions = { checkExist: true, checkPrefix: true }
  ): Promise<void> {
    const { checkExist, checkPrefix } = options;
    if (!code) return;

    if (checkPrefix && code.startsWith(this.codePrefix)) {
      throw new BadRequestException(
        `Mã nhà cung cấp không được bắt đầu là ${this.codePrefix}`
      );
    }

    if (checkExist) {
      const exist = await this.prisma.supplier.findUnique({
        select: {
          id: true,
        },
        where: {
          code,
        },
      });

      if (exist) {
        throw new BadRequestException('Mã nhà cung cấp đã tồn tại');
      }
    }
  }

  async checkId(id: string | undefined): Promise<number> {
    if (!isInteger(id)) {
      throw new BadRequestException('Mã không hợp lệ');
    }

    const supplierId = parseInt(id);
    const record = await this.prisma.supplier.findUnique({
      select: {
        id: true,
        void: true,
      },
      where: {
        id: supplierId,
      },
    });

    if (!record || record.void) {
      throw new NotFoundException({
        message: 'Nhà cung cấp không tồn tại hoặc đã bị xoá',
      });
    }

    return supplierId;
  }
}
