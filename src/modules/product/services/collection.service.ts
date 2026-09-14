import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCollectionDTO, UpdateCollectionDTO } from '../product';

@Injectable()
export class CollectionService {
  constructor(private prisma: PrismaService) {}

  async getCollectionDetail(slug: string) {
    return this.prisma.collection.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        categories: {
          select: {
            id: true,
            slug: true,
            image: true,
            title: true,
          },
        },
      },
    });
  }

  async getCollections() {
    return this.prisma.collection.findMany({
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
  }

  async createCollection(dto: CreateCollectionDTO): Promise<string | void> {
    const collections = await this.prisma.collection.findMany();
    if (collections.length >= 5) return 'Số lượng bộ sưu tập đã đạt tối đa';

    const isTitleExist = await this.prisma.collection.findUnique({
      where: {
        title: dto.title.trim(),
      },
    });

    if (isTitleExist) return 'Tiêu đề đã tồn tại';

    const isSlugExist = await this.prisma.collection.findUnique({
      where: {
        slug: dto.slug.trim(),
      },
    });

    if (isSlugExist) return 'Đường dẫn đã tồn tại';

    const { _max } = await this.prisma.collection.aggregate({
      _max: {
        position: true,
      },
    });

    await this.prisma.collection.create({
      data: {
        title: dto.title.trim(),
        slug: dto.slug.trim(),
        position: _max.id ? _max.id + 1 : 1,
      },
    });
  }

  async updateCollection(dto: UpdateCollectionDTO): Promise<string | void> {
    const isTitleExist = await this.prisma.collection.findFirst({
      where: {
        title: dto.title,
        id: {
          not: parseInt(dto.id),
        },
      },
    });

    if (isTitleExist) return 'Tiêu đề đã tồn tại';

    const isSlugExist = await this.prisma.collection.findFirst({
      where: {
        slug: dto.slug,
        id: {
          not: parseInt(dto.id),
        },
      },
    });

    if (isSlugExist) return 'Đường dẫn đã tồn tại';

    await this.prisma.collection.update({
      where: {
        id: parseInt(dto.id),
      },
      data: {
        title: dto.title.trim(),
        slug: dto.slug.trim(),
      },
    });
  }

  async deleteCollection(id: number): Promise<void> {
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
  }
}
