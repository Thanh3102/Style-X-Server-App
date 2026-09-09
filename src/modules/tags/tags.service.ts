import { Injectable } from '@nestjs/common';
import { TagType } from './tag.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { Response } from 'express';
import { convertToNumber } from 'src/utils/helper/StringHelper';
import { QueryParams } from 'src/utils/types';
import { Prisma, Tag } from '@prisma/client';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly tagBasicInfoSelect: Prisma.TagSelect = {
    id: true,
    name: true,
  };

  async create(type: TagType, name: string): Promise<Tag> {
    const tag = await this.prisma.tag.create({
      data: {
        name,
        type,
      },
    });
    return tag;
  }

  async getTags(res: Response, params: QueryParams): Promise<Response> {
    const { limit: lim, page: pg, query, tagType } = params;
    const page = convertToNumber(pg);
    const limit = convertToNumber(lim);

    // const tagCount = await this.prisma.tag.count();

    let queryCondition: Prisma.TagWhereInput = {};

    if (query) {
      queryCondition = {
        name: {
          startsWith: query,
        },
      };
    }

    const whereCondition = {
      type: tagType,
      ...queryCondition,
    };

    const tags = await this.prisma.tag.findMany({
      select: this.tagBasicInfoSelect,
      skip: page ? (page === 1 ? 0 : limit * (page - 1)) : 0,
      take: limit ? limit : undefined,
      where: whereCondition,
    });

    return res.status(200).json({
      tags: tags.map((tag) => tag.name),
    });
  }
}
