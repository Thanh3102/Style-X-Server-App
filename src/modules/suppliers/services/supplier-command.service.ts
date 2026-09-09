import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { TagType } from '../../tags/tag.type';
import { CreateSupplierDTO, UpdateSupplierDTO } from '../suppliers.type';

@Injectable()
export class SupplierCommandService {
  private readonly codePrefix = 'SUP';
  private readonly tagType = TagType.SUPPLIER;

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDTO, userId: number): Promise<number> {
    const { id: supplierId } = await this.prisma.$transaction(async (p) => {
      const supplier = await p.supplier.create({
        data: {
          code:
            dto.code ?? (await generateCustomID(this.codePrefix, 'supplier')),
          name: dto.name,
          country: dto.country,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          detailAddress: dto.detailAddress,
          email: dto.email,
          taxCode: dto.taxCode,
          fax: dto.fax,
          phoneNumber: dto.phoneNumber,
          website: dto.website,
          createdUserId: userId,
          lastUpdateUserId: userId,
          assignedId: Number(dto.assignedId),
        },
        select: {
          id: true,
        },
      });

      const allSupplierTags = await this.prisma.tag.findMany({
        select: {
          id: true,
          name: true,
        },
        where: {
          type: this.tagType,
        },
      });

      for (const dtoTag of dto.tags) {
        const findTag = allSupplierTags.find((tag) => tag.name === dtoTag);
        if (findTag) {
          await p.supplierTag.create({
            data: {
              supplierId: supplier.id,
              tagId: Number(findTag.id),
            },
          });
        } else {
          await p.tag.create({
            data: {
              name: dtoTag,
              type: this.tagType,
              supplierTags: {
                create: {
                  supplierId: supplier.id,
                },
              },
            },
          });
        }
      }

      await p.tag.updateMany({
        data: {
          lastUsedAt: new Date(),
        },
        where: {
          name: {
            in: dto.tags,
          },
          type: this.tagType,
        },
      });

      return supplier;
    });

    return supplierId;
  }

  async update(dto: UpdateSupplierDTO, requestUserId: number): Promise<number> {
    const { id: supplierId } = await this.prisma.$transaction(async (p) => {
      const updateSupplier = await p.supplier.update({
        where: {
          id: dto.id,
        },
        data: {
          code: dto.code,
          name: dto.name,
          country: dto.country,
          province: dto.province,
          district: dto.district,
          ward: dto.ward,
          detailAddress: dto.detailAddress,
          email: dto.email,
          taxCode: dto.taxCode,
          fax: dto.fax,
          phoneNumber: dto.phoneNumber,
          website: dto.website,
          active: dto.active,
          lastUpdateUserId: requestUserId,
          assignedId: Number(dto.assignedId),
        },
      });

      const allSupplierTags = await p.tag.findMany({
        select: {
          id: true,
          name: true,
        },
        where: {
          type: this.tagType,
        },
      });

      const supplierTags = await p.tag.findMany({
        select: {
          id: true,
          name: true,
        },
        where: {
          type: this.tagType,
          supplierTags: {
            some: {
              supplierId: dto.id,
            },
          },
        },
      });

      const deletedSupplierTagIds: number[] = [];
      for (const tag of supplierTags) {
        const findTag = dto.tags.find((value) => value === tag.name);
        if (!findTag) deletedSupplierTagIds.push(tag.id);
      }

      const addedTags: string[] = [];
      const updateLastUsedTags: string[] = [];

      dto.tags.map((tagName) => {
        const findTag = supplierTags.find((tag) => tag.name === tagName);
        if (!findTag) addedTags.push(tagName);
        else updateLastUsedTags.push(tagName);
      });

      for (const addedTag of addedTags) {
        const findTag = allSupplierTags.find((tag) => tag.name === addedTag);
        if (findTag) {
          await p.supplierTag.create({
            data: {
              supplierId: updateSupplier.id,
              tagId: Number(findTag.id),
            },
          });
        } else {
          await p.tag.create({
            data: {
              name: addedTag,
              type: this.tagType,
              supplierTags: {
                create: {
                  supplierId: updateSupplier.id,
                },
              },
            },
          });
        }
      }

      await p.tag.updateMany({
        data: {
          lastUsedAt: new Date(),
        },
        where: {
          name: {
            in: updateLastUsedTags.map((tag) => tag),
          },
          type: this.tagType,
        },
      });

      await p.supplierTag.deleteMany({
        where: {
          tagId: {
            in: deletedSupplierTagIds,
          },
          supplierId: updateSupplier.id,
        },
      });

      return updateSupplier;
    });

    return supplierId;
  }

  async delete(id: number, requestUserId: number): Promise<void> {
    await this.prisma.supplier.update({
      data: {
        void: true,
        deletedUserId: requestUserId,
      },
      where: {
        id,
      },
    });
  }
}
