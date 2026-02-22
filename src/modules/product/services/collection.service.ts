import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCollectionDTO, UpdateCollectionDTO } from '../product';

@Injectable()
export class CollectionService {
  constructor(private prisma: PrismaService) {}

  async getCollection(res: Response) {
    try {
      const collections = await this.prisma.collection.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          categories: {
            select: {
              id: true,
              image: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: {
          position: 'asc',
        },
      });
      return res.status(200).json(collections);
    } catch (error) {
      Logger.error(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async createCollection(dto: CreateCollectionDTO, req, res: Response) {
    try {
      const collections = await this.prisma.collection.findMany();
      if (collections.length >= 5)
        return res
          .status(400)
          .json({ message: 'Số lượng bộ sưu tập đã đạt tối đa' });

      const isTitleExist = await this.prisma.collection.findUnique({
        where: {
          title: dto.title.trim(),
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.collection.findUnique({
        where: {
          slug: dto.slug.trim(),
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      const { _max } = await this.prisma.collection.aggregate({
        _max: {
          position: true,
        },
      });

      const createdCollection = await this.prisma.collection.create({
        data: {
          title: dto.title.trim(),
          slug: dto.slug.trim(),
          position: _max.id ? _max.id + 1 : 1,
        },
      });

      return res.status(200).json({ message: 'Thêm thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateCollection(dto: UpdateCollectionDTO, req, res: Response) {
    try {
      const isTitleExist = await this.prisma.collection.findFirst({
        where: {
          title: dto.title,
          id: {
            not: parseInt(dto.id),
          },
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.collection.findFirst({
        where: {
          slug: dto.slug,
          id: {
            not: parseInt(dto.id),
          },
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      const updatedCategory = await this.prisma.collection.update({
        where: {
          id: parseInt(dto.id),
        },
        data: {
          title: dto.title.trim(),
          slug: dto.slug.trim(),
        },
      });

      return res.status(200).json({ message: 'Cập nhật thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async deleteCollection(id: number, res: Response) {
    try {
      await this.prisma.$transaction(async (p) => {
        const deleteCollection = await p.collection.delete({
          where: {
            id: id,
          },
        });

        const collections = await this.prisma.collection.findMany();

        for (const collection of collections) {
          if (collection.position > deleteCollection.position) {
            await this.prisma.collection.update({
              where: {
                id: collection.id,
              },
              data: {
                position: {
                  decrement: 1,
                },
              },
            });
          }
        }
      });
      return res.json({ message: 'Đã xóa bộ sưu tập' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }
}
