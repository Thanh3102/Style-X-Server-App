import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CartCronService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 0 0 * * *', {
    name: 'deleteExpireGuestCart',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async deleteExpireGuestCart(): Promise<void> {
    await this.prisma.$transaction(
      async (p) => {
        await p.guestCartItem.deleteMany({
          where: {
            cart: {
              expires: {
                lt: new Date(),
              },
            },
          },
        });

        await p.guestCart.deleteMany({
          where: {
            expires: {
              lt: new Date(),
            },
          },
        });
      },
      {
        maxWait: 30000,
        timeout: 30000,
      }
    );
  }
}
