import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryParams } from 'src/utils/types';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  async get(queryParams: QueryParams) {
    const warehouses = await this.prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        country: true,
        province: true,
        district: true,
        ward: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
      },
    });
    return warehouses;
  }

}
