import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { transformCreatedOnParams } from 'src/utils/helper/DateHelper';
import { QueryParams } from 'src/utils/types/query.types';
import { TagType } from '../../tags/tag.type';
import { ReceiveInventoryMapper } from './receive-inventory-mapper.service';

@Injectable()
export class ReceiveInventoryQueryService {
  private readonly tagType = TagType.RECEIVE;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ReceiveInventoryMapper = new ReceiveInventoryMapper()
  ) {}

  async getTags(receiveId: number): Promise<string[]> {
    const tags = await this.prisma.tag.findMany({
      where: {
        type: this.tagType,
        receiveTags: {
          some: { receiveId },
        },
      },
    });
    return tags.map((tag) => tag.name);
  }

  async get(queryParams: QueryParams) {
    const {
      page: pageParam,
      limit: limitParam,
      query,
      createdOn,
      createdOnMax,
      createdOnMin,
      receiveStatus,
      receiveTransactionStatus,
    } = queryParams;

    const page = !isNaN(Number(pageParam)) ? Number(pageParam) : 1;
    const limit = !isNaN(Number(limitParam)) ? Number(limitParam) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    const where: Prisma.ReceiveInventoryWhereInput = { void: false };

    if (query) {
      where.OR = [
        { code: { startsWith: query.trim() } },
        { warehouse: { name: { startsWith: query.trim() } } },
        { supplier: { name: { startsWith: query.trim() } } },
        { createUser: { name: { startsWith: query.trim() } } },
      ];
    }

    if (receiveStatus) where.status = receiveStatus;
    if (receiveTransactionStatus) {
      where.transactionStatus = receiveTransactionStatus;
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

    const receives = await this.prisma.receiveInventory.findMany({
      where,
      select: {
        id: true,
        code: true,
        createdAt: true,
        warehouse: {
          select: { id: true, name: true },
        },
        status: true,
        transactionStatus: true,
        totalReceipt: true,
        supplier: {
          select: { id: true, name: true },
        },
        createUser: {
          select: { id: true, name: true },
        },
        totalItems: true,
        expectedAt: true,
        note: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const count = await this.prisma.receiveInventory.count({ where });
    return this.mapper.toListResponse(receives, count, page, limit);
  }

  async getDetail(receiveId: number) {
    const data = await this.prisma.receiveInventory.findUnique({
      where: { id: receiveId },
      select: {
        id: true,
        code: true,
        expectedAt: true,
        status: true,
        transactionStatus: true,
        note: true,
        totalItems: true,
        totalItemsDiscount: true,
        totalItemsPrice: true,
        totalLandedCost: true,
        totalReceipt: true,
        totalItemsPriceBeforeDiscount: true,
        transactionRemainAmount: true,
        void: true,
        createdAt: true,
        receiveHistories: {
          select: {
            id: true,
            action: true,
            type: true,
            createdAt: true,
            changedUser: {
              select: { name: true },
            },
            receiveTransaction: {
              select: {
                id: true,
                paymentMethod: true,
                amount: true,
                createdAt: true,
                processedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        receiveLandedCosts: {
          select: { id: true, name: true, price: true },
        },
        items: {
          select: {
            id: true,
            discountAmount: true,
            discountTotal: true,
            discountType: true,
            discountValue: true,
            finalPrice: true,
            finalTotal: true,
            price: true,
            quantity: true,
            quantityAvaiable: true,
            quantityReceived: true,
            quantityRemain: true,
            variant: {
              select: {
                id: true,
                title: true,
                image: true,
                product: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
          },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
            phoneNumber: true,
            email: true,
            fax: true,
            detailAddress: true,
            active: true,
          },
        },
      },
    });

    if (!data) throw new NotFoundException('Đơn nhập hàng không tồn tại');

    const tags = await this.getTags(receiveId);
    return this.mapper.toDetailResponse(data, tags);
  }
}
