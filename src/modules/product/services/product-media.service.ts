import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';

@Injectable()
export class ProductMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService
  ) {}

  async updateMainImage(productId: number, image: string): Promise<void> {
    await this.prisma.product.update({
      data: {
        image,
      },
      where: {
        id: productId,
      },
    });
  }

  async deleteImage(url: string, publicId: string): Promise<void> {
    await this.prisma.$transaction(async (p) => {
      const {
        product: { id, image },
      } = await p.productImages.findUnique({
        where: {
          publicId,
        },
        select: {
          product: {
            select: {
              id: true,
              image: true,
            },
          },
        },
      });

      if (url === image) {
        await p.product.update({
          where: {
            id,
          },
          data: {
            image: null,
          },
        });
      }

      await p.productImages.delete({
        where: {
          publicId,
        },
      });
    });

    await this.cloudinary.deleteFile(publicId);
  }

  async addImage(
    productId: number,
    images: Array<Express.Multer.File>
  ): Promise<void> {
    const uploadedPublicIds: string[] = [];
    try {
      await this.prisma.$transaction(
        async (p) => {
          for (const image of images) {
            const result = await this.cloudinary.uploadFile(image);
            uploadedPublicIds.push(result.public_id);
            await p.productImages.create({
              data: {
                url: result.secure_url,
                publicId: result.public_id,
                assetId: result.asset_id,
                bytes: image.size,
                productId,
              },
            });
          }
        },
        { maxWait: 60000, timeout: 60000 }
      );
    } catch (error) {
      for (const publicId of uploadedPublicIds) {
        await this.cloudinary.deleteFile(publicId);
      }
      throw error;
    }
  }
}
