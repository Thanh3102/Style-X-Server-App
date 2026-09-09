import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { OrderStatus } from '../../order/order.type';
import { ReceiveInventoryStatus } from '../../receive-inventory/receive-inventory.type';
import { CreateWarehouseDto, UpdateWarehouseDto } from '../warehouses.type';

@Injectable()
export class WarehouseCommandService {
  private readonly logger = new Logger(WarehouseCommandService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createWarehouse(
    dto: CreateWarehouseDto,
    createdUserId: number
  ): Promise<void> {
    const existingWarehouse = await this.prisma.warehouse.findFirst({
      where: {
        name: dto.name,
      },
    });

    if (existingWarehouse) {
      throw new BadRequestException('Tên kho hàng đã sử dụng');
    }

    const code = await generateCustomID('WH', 'warehouse');

    await this.prisma.warehouse.create({
      data: {
        code,
        name: dto.name,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        province: dto.province,
        district: dto.district,
        ward: dto.ward,
        createdUserId,
      },
    });
  }

  async updateWarehouse(
    dto: UpdateWarehouseDto,
    updatedUserId: number
  ): Promise<void> {
    const existingWarehouse = await this.prisma.warehouse.findFirst({
      where: {
        name: dto.name,
        id: {
          not: dto.id,
        },
      },
    });

    if (existingWarehouse) {
      throw new BadRequestException('Tên kho hàng đã sử dụng');
    }

    if (dto.active === false) {
      await this.ensureWarehouseHasNoPendingTransactions(dto.id);
    }

    await this.prisma.warehouse.update({
      where: {
        id: dto.id,
      },
      data: {
        name: dto.name,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        province: dto.province,
        district: dto.district,
        ward: dto.ward,
        active: dto.active,
        updatedUserId,
      },
    });
  }

  private async ensureWarehouseHasNoPendingTransactions(
    warehouseId: number
  ): Promise<void> {
    const receives = await this.prisma.receiveInventory.findFirst({
      where: {
        warehouseId,
        status: {
          in: [
            ReceiveInventoryStatus.NOT_RECEIVED,
            ReceiveInventoryStatus.PARTIALLY_RECEIVED,
          ],
        },
      },
      select: {
        id: true,
      },
    });

    const orderSources = await this.prisma.order.findFirst({
      where: {
        status: {
          not: {
            in: [OrderStatus.COMPLETE, OrderStatus.CANCEL],
          },
        },
        items: {
          some: {
            sources: {
              some: {
                warehouseId,
              },
            },
          },
        },
      },
    });

    this.logger.debug({ receives, orderSources });

    if (receives || orderSources) {
      throw new BadRequestException(
        'Không thể cập nhật trạng thái khi kho hàng vẫn còn giao dịch chưa hoàn thành'
      );
    }
  }
}
