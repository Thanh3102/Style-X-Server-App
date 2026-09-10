import { Injectable } from '@nestjs/common';
import { Cart, CartItem } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaTransactionClient } from 'src/prisma/prisma.types';
import { ProductQueryService } from '../../product/services/product-query.service';
import { CartStockPolicy } from './cart-stock-policy.service';

export type CustomerCartWithItems = Cart & { items: CartItem[] };

@Injectable()
export class CartCustomerQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productQueryService: ProductQueryService,
    private readonly stockPolicy: CartStockPolicy
  ) {}

  getCartItemsData(prisma: PrismaTransactionClient, ids: number[]) {
    return prisma.cartItem.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        variant: {
          select: {
            id: true,
            sellPrice: true,
            costPrice: true,
            title: true,
            inventories: {
              select: {
                avaiable: true,
              },
            },
          },
        },
        quantity: true,
      },
    });
  }

  findUserCartById(userId: string): Promise<CustomerCartWithItems | null> {
    return this.prisma.cart.findUnique({
      where: {
        customerId: userId,
      },
      include: {
        items: true,
      },
    });
  }

  async findCartItems(cartId: number) {
    const items = await this.prisma.cartItem.findMany({
      where: {
        cartId,
        product: {
          void: false,
          avaiable: true,
        },
        variant: {
          void: false,
        },
      },
      select: {
        id: true,
        product: {
          select: {
            id: true,
            name: true,
            image: true,
            sellPrice: true,
            unit: true,
            type: true,
            variants: {
              select: {
                id: true,
                option1: true,
                option2: true,
                option3: true,
              },
            },
          },
        },
        variant: {
          select: {
            id: true,
            sellPrice: true,
            comparePrice: true,
            image: true,
            title: true,
            option1: true,
            option2: true,
            option3: true,
            unit: true,
          },
        },
        quantity: true,
        selected: true,
      },
    });

    return Promise.all(
      items.map(async (item) => ({
        ...item,
        options: await this.productQueryService.getProductOptions(
          item.product.id
        ),
        avaiable: await this.stockPolicy.getAvailable(item.variant.id),
      }))
    );
  }
}
