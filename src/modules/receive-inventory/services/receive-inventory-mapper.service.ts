import { Injectable } from '@nestjs/common';

@Injectable()
export class ReceiveInventoryMapper {
  toListResponse<T>(
    receiveInventory: T[],
    count: number,
    page: number,
    limit: number
  ): {
    receiveInventory: T[];
    paginition: {
      total: number;
      count: number;
      page: number;
      limit: number;
    };
  } {
    return {
      receiveInventory,
      paginition: {
        total: Math.ceil(count / limit),
        count,
        page,
        limit,
      },
    };
  }

  toDetailResponse<T>(data: T, tags: string[]): T & { tags: string[] } {
    return { ...data, tags };
  }
}
