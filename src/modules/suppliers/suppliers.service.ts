import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CheckCodeOptions,
  CreateSupplierDTO,
  UpdateSupplierDTO,
} from './suppliers.type';
import { TagType } from '../tags/tag.type';
import { Response } from 'express';
import { TagsService } from '../tags/tags.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { EmployeesService } from '../employees/employees.service';
import { QueryParams } from 'src/utils/types';
import {
  convertParamsToCondition,
  tranformCreatedOnParams,
} from 'src/utils/helper/DateHelper';
import { isInteger } from 'src/utils/helper/StringHelper';
import { Prisma } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private tagService: TagsService,
    private employeeService: EmployeesService,
  ) {}

  private codePrefix = 'SUP';
  private tagType = TagType.SUPPLIER;

  async create(dto: CreateSupplierDTO, req, res: Response) {
    const userId = req.user.id;
    await this.checkCode(dto.code);

    try {
      const { id: supplierId } = await this.prisma.$transaction(async (p) => {
        // Tạo supplier
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

        // Lấy tất cả tag có loại supplier
        const allSupplierTags = await this.prisma.tag.findMany({
          select: {
            id: true,
            name: true,
          },
          where: {
            type: this.tagType,
          },
        });

        // Tạo supplier-tag - Tạo tag mới nếu chưa tồn tại
        for (let dtoTag of dto.tags) {
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

        // Update lần cuối sử dụng tag
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

      return res.status(200).json({ status: 'success', id: supplierId });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi tạo nhà cung cấp',
      );
    }
  }

  async update(dto: UpdateSupplierDTO, req, res: Response) {
    await this.checkCode(dto.code, { checkExist: false });

    const requestUserId = req.user.id;

    try {
      const { id: supplierId } = await this.prisma.$transaction(async (p) => {
        // Cập nhật supplier
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

        // Danh sách tất cả tag
        const allSupplierTags = await p.tag.findMany({
          select: {
            id: true,
            name: true,
          },
          where: {
            type: this.tagType,
          },
        });

        // Lấy danh sách tag của supplier hiện tại
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

        // Lọc ra các tag cần xóa khỏi supplier hiện tại
        let deletedSupplierTagIds: number[] = [];
        for (let tag of supplierTags) {
          const findTag = dto.tags.find((t) => t === tag.name);
          if (!findTag) deletedSupplierTagIds.push(tag.id);
        }

        // Danh sách tag cần tạo mới
        let addedTags: string[] = [];

        // Danh sách tag đã tồn tại, chỉ cập nhật thời gian sử dụng
        let updateLastUsedTags: string[] = [];

        // Lọc ra các tag cần thêm vào và các tag cần update lần cuối sử dụng
        dto.tags.map((tagName) => {
          const findTag = supplierTags.find((t) => t.name === tagName);
          if (!findTag) addedTags.push(tagName);
          else updateLastUsedTags.push(tagName);
        });

        // Tạo supplier tag - Tạo tag mới nếu chưa tồn tại
        for (let addedTag of addedTags) {
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

        // Update lần cuối sử dụng tag
        await p.tag.updateMany({
          data: {
            lastUsedAt: new Date(),
          },
          where: {
            name: {
              in: updateLastUsedTags.map((t) => t),
            },
            type: this.tagType,
          },
        });

        // Xóa các tag không sử dụng của supplier
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

      return res.status(200).json({
        status: 'success',
        id: supplierId,
        message: 'Lưu nhà cung cấp thành công',
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Đã xảy ra lỗi khi cập nhật');
    }
  }

  async delete(id: number, req, res: Response) {
    const requestUserId = req.user.id;
    try {
      await this.prisma.supplier.update({
        data: {
          void: true,
          deletedUserId: requestUserId,
        },
        where: {
          id: id,
        },
      });

      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.log(error);
    }
  }

  async getData(res, queryParams: QueryParams) {
    const {
      page: pg,
      limit: lim,
      query,
      createdOn,
      createdOnMax,
      createdOnMin,
      assignIds,
      active,
    } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 10;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      void: false,
    };

    if (query) {
      where.OR = [
        {
          name: {
            contains: query,
          },
        },
        {
          code: {
            contains: query,
          },
        },
        {
          phoneNumber: {
            contains: query,
          },
        },
      ];
    }

    if (createdOn || createdOnMin || createdOnMax) {
      const { startDate, endDate } = tranformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax,
      );
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }
    }

    if (assignIds && typeof assignIds === 'string') {
      const stringValues = assignIds.split(',');
      const values: Set<number> = new Set();
      for (let v of stringValues) {
        if (!isNaN(Number(v))) values.add(Number(v));
      }

      where.assignedId = {
        in: Array.from(values),
      };
    }

    if (active) {
      where.active = active === 'true';
    }

    try {
      const suppliers = await this.prisma.supplier.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          active: true,
          phoneNumber: true,
          email: true,
        },
        where: where,
        take: limit,
        skip: skip,
      });

      const countSupplier = await this.prisma.supplier.count({
        where: where,
      });
      const totalPage = Math.floor(countSupplier / limit);

      return res.status(200).json({
        suppliers: suppliers,
        paginition: {
          total: countSupplier % limit == 0 ? totalPage : totalPage + 1,
          count: countSupplier,
          page: page,
          limit: limit,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async getDetail(id: string | undefined, res: Response) {
    try {
      if (!isInteger(id)) throw new BadRequestException('Mã không hợp lệ');

      await this.checkId(parseInt(id));

      const supplier = await this.prisma.supplier.findUnique({
        select: {
          id: true,
          code: true,
          country: true,
          province: true,
          district: true,
          ward: true,
          detailAddress: true,
          active: true,
          createdAt: true,
          email: true,
          phoneNumber: true,
          fax: true,
          name: true,
          taxCode: true,
          website: true,
          assignedId: true,
        },
        where: {
          id: Number(id),
        },
      });

      const supplierTags = await this.prisma.tag.findMany({
        select: {
          // id: true,
          name: true,
        },
        where: {
          supplierTags: {
            some: {
              supplierId: supplier.id,
            },
          },
        },
      });

      const tags = supplierTags.map((tag) => tag.name);

      const assigner = await this.employeeService.findById(supplier.assignedId);

      const { password, ...assignedData } = assigner;

      const receives = await this.prisma.receiveInventory.findMany({
        where: {
          supplierId: supplier.id,
          void: false,
        },
        select: {
          id: true,
          code: true,
          status: true,
          transactionStatus: true,
          totalReceipt: true,
          totalItems: true,
          transactionRemainAmount: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return res
        .status(200)
        .json({ ...supplier, tags, assigned: { ...assignedData }, receives });
    } catch (error) {
      // console.log(error);
      return res.status(500).json({ error: error.message });
    }
  }

  async checkCode(
    code: string | undefined,
    options: CheckCodeOptions = { checkExist: true, checkPrefix: true },
  ) {
    const { checkExist, checkPrefix } = options;
    if (!code) return;

    if (checkPrefix && code.startsWith(this.codePrefix))
      throw new BadRequestException(
        `Mã nhà cung cấp không được bắt đầu là ${this.codePrefix}`,
      );

    if (checkExist) {
      const exist = await this.prisma.supplier.findUnique({
        select: {
          id: true,
        },
        where: {
          code: code,
        },
      });

      if (exist) throw new BadRequestException('Mã nhà cung cấp đã tồn tại');
    }
  }

  private async checkId(id: number) {
    const record = await this.prisma.supplier.findUnique({
      select: {
        id: true,
        void: true,
      },
      where: {
        id: id as number,
      },
    });

    if (!record) throw new Error('Nhà cung cấp không tồn tại');

    if (record.void) throw new Error('Nhà cung cấp đã bị xóa');
  }
}
