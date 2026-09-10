import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReceiveInventoryValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCodeAvailable(
    code: string | undefined,
    receiveId?: number
  ): Promise<void> {
    if (!code) return;

    const receive = await this.prisma.receiveInventory.findFirst({
      where: {
        code: code.trim(),
        ...(receiveId === undefined ? {} : { id: { not: receiveId } }),
      },
      select: { id: true },
    });

    if (receive) throw new BadRequestException('Mã đơn nhập đã tồn tại');
  }
}
