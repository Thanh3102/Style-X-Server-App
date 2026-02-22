import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductInventoryService {
  constructor(private prisma: PrismaService) {}

  public getInventoryStock = async (productId: number) => {
    const result = await this.prisma.inventory.aggregate({
      _sum: {
        avaiable: true,
        onHand: true,
        onReceive: true,
        onTransaction: true,
      },
      where: {
        productVariant: {
          productId: productId,
        },
      },
    });

    return result._sum;
  };

  public getVariantInventoryStock = async (variantId: number) => {
    const result = await this.prisma.inventory.aggregate({
      _sum: {
        avaiable: true,
        onHand: true,
        onReceive: true,
        onTransaction: true,
      },
      where: {
        variant_id: variantId,
      },
    });

    return result._sum;
  };
}
