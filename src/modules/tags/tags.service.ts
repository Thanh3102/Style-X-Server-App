import { Injectable } from '@nestjs/common';
import { TagType } from './tag.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { Response } from 'express';
import { convertToNumber } from 'src/utils/helper/StringHelper';
import { QueryParams } from 'src/utils/types';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  private tagBasicInfoSelect = {
    id: true,
    name: true,
  };

  async create(type: TagType, name: string) {
    const tag = await this.prisma.tag.create({
      data: {
        name: name,
        type: type,
      },
    });
    return tag;
  }

  async getTags(res: Response, params: QueryParams) {
    const { limit: lim, page: pg, query, tagType } = params;
    let page = convertToNumber(pg);
    let limit = convertToNumber(lim);

    // const tagCount = await this.prisma.tag.count();

    let queryConditon = {};

    if (query) {
      queryConditon = {
        name: {
          startsWith: query,
        },
      };
    }

    const whereCondition = {
      type: tagType,
      ...queryConditon,
    };

    const tags = await this.prisma.tag.findMany({
      select: this.tagBasicInfoSelect,
      skip: page ? (page === 1 ? 0 : limit * (page - 1)) : 0,
      take: limit ? limit : undefined,
      where: whereCondition,
    });

    return res.status(200).json({
      tags: tags.map((t) => t.name),
    });
  }
}
