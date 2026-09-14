import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { comparePassword, hashPlainText } from 'src/utils/helper/bcryptHelper';
import { ChangePasswordDto, UpdateInfoDto } from '../customer.type';

const customerInfoSelect = {
  id: true,
  name: true,
  dob: true,
  email: true,
  gender: true,
} satisfies Prisma.CustomerSelect;

export type CustomerInfo = Prisma.CustomerGetPayload<{
  select: typeof customerInfoSelect;
}>;

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getInfo(customerId: string): Promise<CustomerInfo | null> {
    return this.prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: customerInfoSelect,
    });
  }

  async updateInfo(customerId: string, dto: UpdateInfoDto): Promise<void> {
    await this.prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        name: dto.name,
        gender: dto.gender,
      },
    });
  }

  async changePassword(
    customerId: string,
    dto: ChangePasswordDto
  ): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        password: true,
      },
    });

    if (!customer) {
      throw new BadRequestException('Không tìm thấy thông tin khách hàng');
    }

    const isCorrectPassword = await comparePassword(
      dto.oldPassword,
      customer.password
    );

    if (!isCorrectPassword) {
      throw new BadRequestException('Mật khẩu cũ không chính xác');
    }

    await this.prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        password: await hashPlainText(dto.newPassword),
      },
    });
  }
}
