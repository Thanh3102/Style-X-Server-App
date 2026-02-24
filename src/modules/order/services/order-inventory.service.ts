import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CartItem } from '../order.type';
import { PrismaTransactionObject } from 'src/prisma/prisma.types';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';

@Injectable()
export class OrderInventoryService {
  constructor() {}
  async findItemReceive(item: CartItem, p: PrismaTransactionObject) {
    // Lọc ra các lô hàng có sản phẩm này (Xếp theo lô hàng nhập lâu nhất còn hàng và theo thứ tự kho )
    const receiveItems = await p.receiveItem.findMany({
      where: {
        variantId: item.variant.id,
        quantityAvaiable: {
          gt: 0,
        },
      },
      include: {
        receiveInventory: {
          select: {
            id: true,
            warehouseId: true,
          },
        },
      },
      orderBy: {
        receiveInventory: {
          createdAt: 'asc',
          //   warehouseId: 'desc',
        },
      },
    });

    // Lưu lại sản phẩm được lấy từ đâu
    const itemsFrom: {
      receiveId: number | null;
      warehouseId: number;
      quantity: number;
      costPrice: number;
    }[] = [];

    // Số lượng sản phẩm cần lấy còn lại
    let itemQuantityNeedRemain = item.quantity;
    for (const receiveItem of receiveItems) {
      const inventory = await p.inventory.findFirst({
        where: {
          warehouse_id: receiveItem.receiveInventory.warehouseId,
          variant_id: item.variant.id,
          warehouse: {
            active: true,
          },
        },
      });
      if (itemQuantityNeedRemain === 0) break;
      // Nếu số lượng có sẵn > số lượng cần lấy
      if (receiveItem.quantityAvaiable > itemQuantityNeedRemain) {
        // Update Giảm số lượng có sản trong lô hàng đó
        await p.receiveItem.update({
          where: {
            id: receiveItem.id,
          },
          data: {
            quantityAvaiable: {
              decrement: itemQuantityNeedRemain,
            },
          },
        });

        // Update tồn kho -> giao dịch ở kho đã lấy
        await p.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            avaiable: {
              decrement: itemQuantityNeedRemain,
            },
            histories: {
              create: {
                transactionType: InventoryTransactionType.ORDER,
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                avaiableQuantityChange: itemQuantityNeedRemain * -1,
                OnTransactionQuantityChange: itemQuantityNeedRemain,
                newAvaiable: inventory.avaiable - itemQuantityNeedRemain,
                newOnTransaction:
                  inventory.onTransaction + itemQuantityNeedRemain,
              },
            },
          },
        });

        // Lưu lại nơi đã lấy
        itemsFrom.push({
          quantity: itemQuantityNeedRemain,
          receiveId: receiveItem.receiveInventory.id,
          warehouseId: receiveItem.receiveInventory.warehouseId,
          costPrice: receiveItem.finalPrice,
        });
        // Giảm số lượng cần lấy về 0
        itemQuantityNeedRemain = 0;
      } else {
        await p.receiveItem.update({
          where: {
            id: receiveItem.id,
          },
          data: {
            quantityAvaiable: 0,
          },
        });

        // Update tồn kho -> giao dịch ở kho đã lấy
        await p.inventory.update({
          where: {
            id: inventory.id,
          },
          data: {
            avaiable: {
              decrement: itemQuantityNeedRemain,
            },
            onTransaction: {
              increment: itemQuantityNeedRemain,
            },
            histories: {
              create: {
                transactionType: InventoryTransactionType.ORDER,
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                avaiableQuantityChange: itemQuantityNeedRemain * -1,
                OnTransactionQuantityChange: itemQuantityNeedRemain,
                newAvaiable: inventory.avaiable - itemQuantityNeedRemain,
                newOnTransaction:
                  inventory.onTransaction + itemQuantityNeedRemain,
              },
            },
          },
        });

        itemsFrom.push({
          quantity: receiveItem.quantityAvaiable,
          receiveId: receiveItem.receiveInventory.id,
          warehouseId: receiveItem.receiveInventory.warehouseId,
          costPrice: receiveItem.finalPrice,
        });

        // Giảm số lượng cần lấy còn lại
        itemQuantityNeedRemain -= receiveItem.quantityAvaiable;
      }
    }

    /* 
        Nếu đã lặp qua các đơn nhập và còn thiếu 
        -> Kiểm tra tồn kho thực tế  (Do thêm vào thủ công) 
      */
    const inventories = await p.inventory.findMany({
      where: {
        variant_id: item.variant.id,
      },
    });

    for (const inv of inventories) {
      if (itemQuantityNeedRemain === 0) break;
      if (inv.avaiable > itemQuantityNeedRemain) {
        await p.inventory.update({
          where: {
            id: inv.id,
          },
          data: {
            avaiable: {
              decrement: itemQuantityNeedRemain,
            },
            onTransaction: {
              increment: itemQuantityNeedRemain,
            },
            histories: {
              create: {
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                transactionType: InventoryTransactionType.ORDER,
                newAvaiable: inv.avaiable - itemQuantityNeedRemain,
                newOnTransaction: inv.onTransaction + itemQuantityNeedRemain,
                avaiableQuantityChange: itemQuantityNeedRemain * -1,
                OnTransactionQuantityChange: itemQuantityNeedRemain,
              },
            },
          },
        });
        itemsFrom.push({
          costPrice: item.variant.costPrice,
          receiveId: null,
          quantity: itemQuantityNeedRemain,
          warehouseId: inv.warehouse_id,
        });
        // Đặt lại số lượng cần lấy
        itemQuantityNeedRemain = 0;
      } else {
        await p.inventory.update({
          where: {
            id: inv.id,
          },
          data: {
            avaiable: 0,
            onTransaction: {
              increment: inv.avaiable,
            },
            histories: {
              create: {
                transactionAction: InventoryTransactionAction.CREATE_TEMP_ORDER,
                transactionType: InventoryTransactionType.ORDER,
                newAvaiable: 0,
                newOnTransaction: inv.onTransaction + inv.avaiable,
                avaiableQuantityChange: inv.avaiable * -1,
                OnTransactionQuantityChange: inv.avaiable,
              },
            },
          },
        });
        itemsFrom.push({
          costPrice: item.variant.costPrice,
          receiveId: null,
          quantity: inv.avaiable,
          warehouseId: inv.warehouse_id,
        });
        // Đặt lại số lượng cần lấy
        itemQuantityNeedRemain -= inv.avaiable;
      }
    }

    // Nếu không còn hàng ở đơn nhập và ở kho thực tế -> Lỗi tính toán tồn kho
    if (itemQuantityNeedRemain > 0)
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi tính toán hóa đơn. Vui lòng tạo hóa đơn khác'
      );

    return itemsFrom;
  }
}
