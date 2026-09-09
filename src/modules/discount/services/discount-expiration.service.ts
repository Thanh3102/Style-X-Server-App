import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';

@Injectable()
export class DiscountExpirationService {
  private readonly logger = new Logger(DiscountExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 0 * * *')
  async updateExpireDiscount(): Promise<void> {
    try {
      const expireDiscounts = await this.prisma.discount.findMany({
        where: {
          endOn: {
            not: null,
            lt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      const updateIds = expireDiscounts.map((discount) => discount.id);

      await this.prisma.discount.updateMany({
        where: {
          id: {
            in: updateIds,
          },
        },
        data: {
          active: false,
        },
      });
      this.logger.log(`Unactive discount ids: ${updateIds.join(', ')}`);
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
    }
  }
}
