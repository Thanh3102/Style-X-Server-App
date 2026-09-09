import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { transformCreatedOnParams } from 'src/utils/helper/DateHelper';
import { PaginationData, QueryParams } from 'src/utils/types';
import { EmployeeWithPassword } from '../../employees/employee.select';
import { EmployeesService } from '../../employees/employees.service';
import { SupplierValidationService } from './supplier-validation.service';

const supplierListSelect = {
  id: true,
  code: true,
  name: true,
  active: true,
  phoneNumber: true,
  email: true,
} satisfies Prisma.SupplierSelect;

const supplierDetailSelect = {
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
} satisfies Prisma.SupplierSelect;

const supplierReceiveSelect = {
  id: true,
  code: true,
  status: true,
  transactionStatus: true,
  totalReceipt: true,
  totalItems: true,
  transactionRemainAmount: true,
  createdAt: true,
} satisfies Prisma.ReceiveInventorySelect;

export type SupplierListItem = Prisma.SupplierGetPayload<{
  select: typeof supplierListSelect;
}>;

type SupplierDetail = Prisma.SupplierGetPayload<{
  select: typeof supplierDetailSelect;
}>;

type SupplierReceive = Prisma.ReceiveInventoryGetPayload<{
  select: typeof supplierReceiveSelect;
}>;

export type SupplierListResult = {
  suppliers: SupplierListItem[];
  paginition: PaginationData;
};

export type SupplierDetailResult = SupplierDetail & {
  tags: string[];
  assigned: Omit<EmployeeWithPassword, 'password'>;
  receives: SupplierReceive[];
};

export type PreparedSupplierListQuery = {
  page: number;
  limit: number;
  skip: number;
  where: Prisma.SupplierWhereInput;
};

@Injectable()
export class SupplierQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeService: EmployeesService,
    private readonly validationService: SupplierValidationService
  ) {}

  prepareListQuery(queryParams: QueryParams): PreparedSupplierListQuery {
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
      const { startDate, endDate } = transformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax
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
      for (const value of stringValues) {
        if (!isNaN(Number(value))) values.add(Number(value));
      }

      where.assignedId = {
        in: Array.from(values),
      };
    }

    if (active) {
      where.active = active === 'true';
    }

    return { page, limit, skip, where };
  }

  async getData({
    page,
    limit,
    skip,
    where,
  }: PreparedSupplierListQuery): Promise<SupplierListResult> {
    const suppliers = await this.prisma.supplier.findMany({
      select: supplierListSelect,
      where,
      take: limit,
      skip,
    });

    const countSupplier = await this.prisma.supplier.count({
      where,
    });
    const totalPage = Math.floor(countSupplier / limit);

    return {
      suppliers,
      paginition: {
        total: countSupplier % limit == 0 ? totalPage : totalPage + 1,
        count: countSupplier,
        page,
        limit,
      },
    };
  }

  async getDetail(id: string | undefined): Promise<SupplierDetailResult> {
    const supplierId = await this.validationService.checkId(id);

    const supplier = await this.prisma.supplier.findUnique({
      select: supplierDetailSelect,
      where: {
        id: supplierId,
      },
    });

    const supplierTags = await this.prisma.tag.findMany({
      select: {
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
    const { password: _password, ...assignedData } = assigner;

    const receives = await this.prisma.receiveInventory.findMany({
      where: {
        supplierId: supplier.id,
        void: false,
      },
      select: supplierReceiveSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      ...supplier,
      tags,
      assigned: { ...assignedData },
      receives,
    };
  }
}
