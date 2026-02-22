import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { CreateCategoryDTO, UpdateCategoryDTO } from '../product';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService
  ) {}

  async createCategory(dto: CreateCategoryDTO, req, res: Response) {
    try {
      const isTitleExist = await this.prisma.category.findFirst({
        where: {
          title: dto.title.trim(),
          collectionId: parseInt(dto.collectionId),
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.category.findFirst({
        where: {
          slug: dto.slug,
          collectionId: parseInt(dto.collectionId),
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      await this.prisma.$transaction(
        async (p) => {
          const createdCategory = await p.category.create({
            data: {
              title: dto.title.trim(),
              slug: dto.slug.trim(),
              collectionId: parseInt(dto.collectionId),
            },
          });

          if (dto.image) {
            const { secure_url, public_id } = await this.cloudinary.uploadFile(
              dto.image
            );

            await p.category.update({
              where: {
                id: createdCategory.id,
              },
              data: {
                image: secure_url,
                imagePublicId: public_id,
              },
            });
          }
        },
        {
          maxWait: 10000,
          timeout: 10000,
        }
      );

      return res.status(200).json({ message: 'Tạo danh mục thành công' });
    } catch (error) {
      Logger.error(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateCategory(dto: UpdateCategoryDTO, req, res: Response) {
    try {
      const isTitleExist = await this.prisma.category.findFirst({
        where: {
          title: dto.title.trim(),
          id: {
            not: parseInt(dto.id),
          },
          collectionId: parseInt(dto.collectionId),
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.category.findFirst({
        where: {
          slug: dto.slug,
          id: {
            not: parseInt(dto.id),
          },
          collectionId: parseInt(dto.collectionId),
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      await this.prisma.$transaction(
        async (p) => {
          const updatedCategory = await p.category.update({
            where: {
              id: parseInt(dto.id),
            },
            data: {
              title: dto.title.trim(),
              slug: dto.slug.trim(),
            },
          });

          if (dto.image) {
            await this.cloudinary.deleteFile(updatedCategory.imagePublicId);
            const { secure_url, public_id } = await this.cloudinary.uploadFile(
              dto.image
            );

            await p.category.update({
              where: {
                id: updatedCategory.id,
              },
              data: {
                image: secure_url,
                imagePublicId: public_id,
              },
            });
          }
        },
        {
          maxWait: 10000,
          timeout: 10000,
        }
      );

      return res.status(200).json({ message: 'Cập nhật danh mục thành công' });
    } catch (error) {
      Logger.error(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async deleteCategory(id: number, res: Response) {
    try {
      await this.prisma.$transaction(async (p) => {
        await p.productCategory.deleteMany({
          where: {
            categoryId: id,
          },
        });

        const deleteCategory = await p.category.delete({
          where: {
            id: id,
          },
        });

        await this.cloudinary.deleteFile(deleteCategory.imagePublicId);
      });
      return res.json({ message: 'Đã xóa danh mục' });
    } catch (error) {
      Logger.error(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }
}
