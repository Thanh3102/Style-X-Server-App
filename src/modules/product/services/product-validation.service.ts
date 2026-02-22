import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDTO, UpdateVariantDTO } from '../product';

@Injectable()
export class ProductValidationService {
  constructor(private prisma: PrismaService) {}

  public checkCreateProductConflict = async (dto: CreateProductDTO) => {
    if (
      await this.prisma.product.findFirst({
        select: { id: true },
        where: { name: dto.name.trim(), void: false },
      })
    )
      throw new BadRequestException('Tên sản phẩm đã được sử dụng');

    if (dto.variants.length > 0) {
      for (const variant of dto.variants) {
        if (variant.skuCode) {
          const querySkuCode = await this.prisma.productVariants.findFirst({
            where: {
              skuCode: variant.skuCode.trim(),
            },
            select: {
              skuCode: true,
            },
          });
          if (querySkuCode)
            throw new BadRequestException(
              `Mã SKU ${variant.skuCode.trim()} đã được sử dụng`
            );
        }

        if (variant.barCode) {
          const queryBarCode = await this.prisma.productVariants.findFirst({
            where: {
              barCode: variant.barCode.trim(),
            },
            select: {
              barCode: true,
            },
          });
          if (queryBarCode)
            throw new BadRequestException(
              `Mã vạch ${variant.barCode.trim()} đã được sử dụng`
            );
        }
      }
    } else {
      if (dto.skuCode) {
        const querySkuCode = await this.prisma.productVariants.findFirst({
          where: {
            skuCode: dto.skuCode.trim(),
          },
          select: {
            skuCode: true,
          },
        });
        if (querySkuCode)
          throw new BadRequestException(
            `Mã SKU ${dto.skuCode.trim()} đã được sử dụng`
          );
      }

      if (dto.barCode) {
        const queryBarCode = await this.prisma.productVariants.findFirst({
          where: {
            barCode: dto.barCode.trim(),
          },
          select: {
            barCode: true,
          },
        });
        if (queryBarCode)
          throw new BadRequestException(
            `Mã vạch ${dto.barCode.trim()} đã được sử dụng`
          );
      }
    }
  };

  public checkUpdateVariantConflict = async (dto: UpdateVariantDTO) => {
    if (dto.skuCode) {
      const querySkuCode = await this.prisma.productVariants.findFirst({
        where: {
          skuCode: dto.skuCode.trim(),
          id: {
            not: dto.variantId,
          },
        },
        select: {
          skuCode: true,
        },
      });
      if (querySkuCode)
        throw new BadRequestException(
          `Mã SKU ${dto.skuCode.trim()} đã được sử dụng`
        );
    }

    if (dto.barCode) {
      const queryBarCode = await this.prisma.productVariants.findFirst({
        where: {
          id: {
            not: dto.variantId,
          },
          barCode: dto.barCode.trim(),
        },
        select: {
          barCode: true,
        },
      });
      if (queryBarCode)
        throw new BadRequestException(
          `Mã vạch ${dto.barCode.trim()} đã được sử dụng`
        );
    }
  };

  public checkValidProductId = async (id: number) => {
    const product = await this.prisma.product.findUnique({
      where: {
        id: id,
      },
      select: {
        void: true,
      },
    });

    if (!product) throw new Error('Sản phẩm không tồn tại');
    // if (product.void) throw new Error('Sản phẩm đã bị xóa');
  };
}
