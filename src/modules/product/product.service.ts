import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDTO } from './product';
import { Response } from 'express';
import { QueryParams } from 'src/utils/types';
import { startWith } from 'rxjs';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateCategoryDTO, req, res: Response) {
    // Check parent id exist if dto has parentId property
    if (dto.parentId) {
      const isParentExist = await this.prisma.category.findUnique({
        where: {
          id: dto.parentId,
        },
        select: {
          id: true,
        },
      });

      // If parentId not exist in db, throw bad request exception
      if (!isParentExist)
        throw new BadRequestException('Mã danh mục cha không tồn tại');
    }

    // Check if title is exist
    const isTitleExist = await this.prisma.category.findUnique({
      where: {
        title: dto.title,
      },
      select: {
        id: true,
      },
    });

    if (isTitleExist) throw new BadRequestException('Tiêu đề đã tồn tại');

    // Create new category
    const category = await this.prisma.category.create({
      data: {
        title: dto.title,
        slug: dto.slug,
      },
    });

    return res.status(200).json({ data: category });
  }

  async updateCategory(dto, req, res: Response) {
    return null;
  }

  async deleteCategory(dto, req, res: Response) {
    return null;
  }

  async getCategories(queryParams: QueryParams) {
    const { query } = queryParams;

    let conditions = {
      query: {},
    };

    if (query) {
      conditions.query = {
        title: {
          startWith: query,
        },
      };
    }

    const whereCondition = {
      ...conditions.query,
    };

    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
      },
      where: whereCondition,
      take: 10,
      skip: 0,
    });

    return categories;
  }
}
