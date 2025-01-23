import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CancelReceiveInventoryDTO,
  CreateReceiveInventoryDTO,
  ImportItemDTO,
  ProcessPaymentDTO,
  ReceiveHistoryAction,
  ReceiveHistoryType,
  UpdateReceiveInventoryDTO,
} from './receive-inventory.type';
import {
  ReceiveInventoryStatus,
  ReceiveInventoryTransaction,
} from './receive-inventory.type';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
  QueryParams,
} from 'src/utils/types';
import { Response } from 'express';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { TagType } from '../tags/tag.type';
import { Prisma } from '@prisma/client';
import { tranformCreatedOnParams } from 'src/utils/helper/DateHelper';

@Injectable()
export class ReceiveInventoryService {
  constructor(private prisma: PrismaService) {}

  private TagType = TagType.RECEIVE;

  async getTags(receiveId: number) {
    try {
      const tags = await this.prisma.tag.findMany({
        where: {
          type: this.TagType,
          receiveTags: {
            some: {
              receiveId: receiveId,
            },
          },
        },
      });
      return tags.map((tag) => tag.name);
    } catch (error) {}
  }

  async create(dto: CreateReceiveInventoryDTO, req, res: Response) {
    const RequestUserId = req.user.id;
    if (dto.code) {
      const receive = await this.prisma.receiveInventory.findFirst({
        where: {
          code: dto.code.trim(),
        },
      });
      if (receive) throw new BadRequestException('Mã đơn nhập đã tồn tại');
    }
    try {
      const { id } = await this.prisma.$transaction(
        async (p) => {
          // Tạo đơn nhập
          const status = dto.importAfterCreate
            ? ReceiveInventoryStatus.RECEIVED
            : ReceiveInventoryStatus.NOT_RECEIVED;

          const code = dto.code
            ? dto.code.trim()
            : await generateCustomID('RE', 'receiveInventory');

          const createdReceive = await p.receiveInventory.create({
            data: {
              importAfterCreate: dto.importAfterCreate,
              status: status,
              totalItems: dto.totalItems,
              totalItemsDiscount: dto.totalItemsDiscount,
              totalItemsPrice: dto.totalItemsPrice,
              totalLandedCost: dto.totalLandedCost,
              totalReceipt: dto.totalReceipt,
              totalItemsPriceBeforeDiscount: dto.totalItemsPriceBeforeDiscount,
              transactionRemainAmount: dto.totalReceipt,
              transactionStatus: ReceiveInventoryTransaction.UN_PAID,
              note: dto.note.trim(),
              supplierId: dto.supplierId,
              warehouseId: dto.warehouseId,
              expectedAt: dto.expectedOn,
              createUserId: RequestUserId,
              code: code,
            },
          });

          // Thêm item
          const insertItems = dto.items.map((item) => {
            return {
              discountAmount: item.discountAmount,
              discountTotal: item.totalDiscount,
              discountType: item.discountType,
              discountValue: item.discountValue,
              price: item.price,
              total: item.total,
              finalPrice: item.finalPrice,
              finalTotal: item.finalTotal,
              quantity: item.quantity,
              quantityAvaiable: 0,
              quantityReceived: 0,
              quantityRemain: item.quantity,
              receiveId: createdReceive.id,
              variantId: item.variantId,
            };
          });
          await p.receiveItem.createMany({
            data: insertItems,
          });

          // Thêm landed cost item
          const insertLandedItems = dto.landedCosts.map((item) => {
            return {
              ...item,
              receiveId: createdReceive.id,
            };
          });
          await p.receiveLandedCost.createMany({
            data: insertLandedItems,
          });

          // Tạo lịch sử đơn nhập - [Khởi tạo đơn]
          await p.receiveHistory.create({
            data: {
              type: ReceiveHistoryType.RECEIVE,
              action: ReceiveHistoryAction.CREATED,
              changedUserId: RequestUserId,
              receiveId: createdReceive.id,
            },
          });

          // Thêm lịch sử giao dịch nếu đã giao dịch
          if (dto.transactionStatus === ReceiveInventoryTransaction.PAID) {
            // Cập nhật đơn nhập - Nếu đã thanh toán hết thì cập nhật trạng thái
            const newTransactionRemainAmount =
              createdReceive.transactionRemainAmount - dto.transactionAmount;
            await p.receiveInventory.update({
              where: {
                id: createdReceive.id,
              },
              data: {
                transactionRemainAmount: newTransactionRemainAmount,
                transactionStatus:
                  newTransactionRemainAmount <= 0
                    ? ReceiveInventoryTransaction.PAID
                    : ReceiveInventoryTransaction.PARTIALLY_PAID,
              },
            });

            // Tạo lịch sử giao dịch
            const receiveTransaction = await p.receiveTransaction.create({
              data: {
                amount: dto.transactionAmount,
                paymentMethod: dto.transactionMethod,
                processedAt: dto.transactionDate,
                receiveId: createdReceive.id,
              },
            });

            // Tạo lịch sử đơn nhập - [Thanh toán]
            await p.receiveHistory.create({
              data: {
                type: ReceiveHistoryType.PAID,
                action: ReceiveHistoryAction.PAID,
                changedUserId: RequestUserId,
                transactionId: receiveTransaction.id,
                receiveId: createdReceive.id,
              },
            });
          }

          // Cập nhật thông tin tất cả item của đơn nhập
          for (const item of dto.items) {
            // Tìm kiếm xem đã có tồn kho sản phẩm này trong kho chưa ?
            const inventory = await p.inventory.findFirst({
              where: {
                warehouse_id: dto.warehouseId,
                variant_id: item.variantId,
              },
            });

            // Nhập kho nếu chọn nhập kho sau tạo
            if (dto.importAfterCreate) {
              // Cập nhật số lượng có sẵn và chưa nhập / đã nhập
              await p.receiveItem.updateMany({
                where: {
                  receiveId: createdReceive.id,
                  variantId: item.variantId,
                },
                data: {
                  quantityAvaiable: item.quantity,
                  quantityReceived: item.quantity,
                  quantityRemain: 0,
                },
              });
              // Nếu đã có trong tồn kho của kho
              if (inventory) {
                const newOnHand = inventory.onHand + item.quantity;
                const newAvaiable = inventory.avaiable + item.quantity;
                await p.inventory.update({
                  where: {
                    id: inventory.id,
                  },
                  data: {
                    onHand: newOnHand,
                    avaiable: newAvaiable,
                    histories: {
                      create: {
                        transactionAction: InventoryTransactionAction.RECEIPT,
                        transactionType:
                          InventoryTransactionType.RECEIVE_INVENTORY,
                        avaiableQuantityChange: item.quantity,
                        onHandQuantityChange: item.quantity,
                        newAvaiable: newAvaiable,
                        newOnHand: newOnHand,
                        changeUserId: RequestUserId,
                        receiveInventoryId: createdReceive.id,
                      },
                    },
                  },
                });
              } else {
                // Tạo tồn kho mới nếu kho hiện tại chưa có
                const newCreatedInventory = await p.inventory.create({
                  data: {
                    variant_id: item.variantId,
                    avaiable: 0,
                    onHand: 0,
                    onTransaction: 0,
                    onReceive: 0,
                    warehouse_id: dto.warehouseId,
                    histories: {
                      create: {
                        transactionAction:
                          InventoryTransactionAction.INITIAL_SETUP,
                        transactionType:
                          InventoryTransactionType.RECEIVE_INVENTORY,
                        changeUserId: RequestUserId,
                        newAvaiable: 0,
                        newOnHand: 0,
                        newOnReceive: 0,
                        newOnTransaction: 0,
                        receiveInventoryId: createdReceive.id,
                      },
                    },
                  },
                });
                const newOnHand = newCreatedInventory.onHand + item.quantity;
                const newAvaiable =
                  newCreatedInventory.avaiable + item.quantity;
                await p.inventory.update({
                  where: {
                    id: newCreatedInventory.id,
                  },
                  data: {
                    onHand: newOnHand,
                    avaiable: newAvaiable,
                    histories: {
                      create: {
                        transactionAction: InventoryTransactionAction.RECEIPT,
                        transactionType:
                          InventoryTransactionType.RECEIVE_INVENTORY,
                        avaiableQuantityChange: item.quantity,
                        onHandQuantityChange: item.quantity,
                        newAvaiable: newAvaiable,
                        newOnHand: newOnHand,
                        changeUserId: RequestUserId,
                        receiveInventoryId: createdReceive.id,
                      },
                    },
                  },
                });
              }
            } else {
              // Cập nhật hàng đang về của kho
              // Lấy thông tin tồn kho hiện tại của phiên bản trong kho
              if (inventory) {
                const newOnReceive = inventory.onReceive + item.quantity;
                await p.inventory.update({
                  where: {
                    id: inventory.id,
                  },
                  data: {
                    onReceive: newOnReceive,
                    histories: {
                      create: {
                        transactionAction: InventoryTransactionAction.PURCHASE,
                        transactionType:
                          InventoryTransactionType.PURCHASE_ORDER,
                        onReceiveQuantityChange: item.quantity,
                        newOnReceive: newOnReceive,
                        changeUserId: RequestUserId,
                        receiveInventoryId: createdReceive.id,
                      },
                    },
                  },
                });
              } else {
                // Tạo tồn kho mới nếu tồn kho hiện tại của phiên bản chưa có
                const newCreatedInventory = await p.inventory.create({
                  data: {
                    variant_id: item.variantId,
                    avaiable: 0,
                    onHand: 0,
                    onTransaction: 0,
                    onReceive: 0,
                    warehouse_id: dto.warehouseId,
                    histories: {
                      create: {
                        transactionAction:
                          InventoryTransactionAction.INITIAL_SETUP,
                        transactionType:
                          InventoryTransactionType.RECEIVE_INVENTORY,
                        changeUserId: RequestUserId,
                        newAvaiable: 0,
                        newOnHand: 0,
                        newOnReceive: 0,
                        newOnTransaction: 0,
                        receiveInventoryId: createdReceive.id,
                      },
                    },
                  },
                });
                const newOnReceive =
                  newCreatedInventory.onReceive + item.quantity;
                await p.inventory.update({
                  where: {
                    id: newCreatedInventory.id,
                  },
                  data: {
                    onReceive: newOnReceive,
                    histories: {
                      create: {
                        transactionAction: InventoryTransactionAction.PURCHASE,
                        transactionType:
                          InventoryTransactionType.PURCHASE_ORDER,
                        onReceiveQuantityChange: item.quantity,
                        newOnReceive: newOnReceive,
                        changeUserId: RequestUserId,
                        receiveInventoryId: createdReceive.id,
                      },
                    },
                  },
                });
              }
            }
          }

          // Cập nhật tag
          const allReceiveTags = await p.tag.findMany({
            select: {
              id: true,
              name: true,
            },
            where: {
              type: this.TagType,
            },
          });

          for (let dtoTag of dto.tags) {
            const findTag = allReceiveTags.find((tag) => tag.name === dtoTag);
            if (findTag) {
              await p.receiveInventoryTag.create({
                data: {
                  receiveId: createdReceive.id,
                  tagId: Number(findTag.id),
                },
              });
            } else {
              await p.tag.create({
                data: {
                  name: dtoTag,
                  type: this.TagType,
                  receiveTags: {
                    create: {
                      receiveId: createdReceive.id,
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
              type: this.TagType,
            },
          });

          return createdReceive;
        },
        {
          maxWait: 60000,
          timeout: 60000,
        },
      );

      return res.json({ id, message: 'Tạo đơn nhập hàng thành công' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error);
    }
  }

  async update(dto: UpdateReceiveInventoryDTO, req, res: Response) {
    const receive = await this.prisma.receiveInventory.findFirst({
      where: {
        id: {
          not: dto.receiveId,
        },
        code: dto.code.trim(),
      },
      select: {
        id: true,
      },
    });

    if (receive) throw new BadRequestException('Mã đơn nhập đã tồn tại');

    try {
      await this.prisma.$transaction(async (p) => {
        // Cập nhật thông tin đơn nhập
        await p.receiveInventory.update({
          where: {
            id: dto.receiveId,
          },
          data: {
            code: dto.code.trim(),
            expectedAt: dto.expectedOn,
            note: dto.note.trim(),
            receiveHistories: {
              create: {
                action: ReceiveHistoryAction.UPDATE,
                type: ReceiveHistoryType.RECEIVE,
                changedUserId: req.user.id,
              },
            },
          },
        });

        // Cập nhật tag
        // Lấy danh sách các tag hiện tại
        const allReceiveTags = await p.tag.findMany({
          where: {
            type: this.TagType,
          },
          select: {
            id: true,
            name: true,
          },
        });

        for (const tag of dto.addTags) {
          // Kiểm tra tag thêm đã có chưa
          const findTag = allReceiveTags.find((rTag) => rTag.name === tag);
          if (findTag) {
            await p.receiveInventoryTag.create({
              data: {
                receiveId: dto.receiveId,
                tagId: findTag.id,
              },
            });
            // Cập nhật lần cuối sử dụng
            await p.tag.update({
              data: {
                lastUsedAt: new Date(),
              },
              where: {
                id: findTag.id,
              },
            });
          } else {
            // Tạo tag mới nếu chưa có
            await p.tag.create({
              data: {
                name: tag,
                type: this.TagType,
              },
            });
          }
        }

        // Xóa tag không sử dụng cửa đơn nhập
        const deleteTags = allReceiveTags.filter((rTag) =>
          dto.deleteTags.includes(rTag.name),
        );

        await p.receiveInventoryTag.deleteMany({
          where: {
            receiveId: dto.receiveId,
            tagId: {
              in: deleteTags.map((tag) => tag.id),
            },
          },
        });
      });
      return res.json({ message: 'Cập nhật đơn hàng thành công' });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async get(queryParams: QueryParams, res: Response) {
    const {
      page: pg,
      limit: lim,
      query,
      createdOn,
      createdOnMax,
      createdOnMin,
      receiveStatus,
      receiveTransactionStatus,
    } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    let whereCondition: Prisma.ReceiveInventoryWhereInput = {
      void: false,
    };

    if (query) {
      whereCondition.OR = [
        {
          code: {
            startsWith: query.trim(),
          },
        },
        {
          warehouse: {
            name: {
              startsWith: query.trim(),
            },
          },
        },
        {
          supplier: {
            name: {
              startsWith: query.trim(),
            },
          },
        },
        {
          createUser: {
            name: {
              startsWith: query.trim(),
            },
          },
        },
      ];
    }

    if (receiveStatus) {
      whereCondition.status = receiveStatus;
    }

    if (receiveTransactionStatus) {
      whereCondition.transactionStatus = receiveTransactionStatus;
    }

    if (createdOn || createdOnMin || createdOnMax) {
      const { startDate, endDate } = tranformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax,
      );
      if (startDate || endDate) {
        whereCondition.createdAt = {};
        if (startDate) whereCondition.createdAt.gte = startDate;
        if (endDate) whereCondition.createdAt.lte = endDate;
      }
    }

    const receives = await this.prisma.receiveInventory.findMany({
      where: whereCondition,
      select: {
        id: true,
        code: true,
        createdAt: true,
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        status: true,
        transactionStatus: true,
        totalReceipt: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        createUser: {
          select: {
            id: true,
            name: true,
          },
        },
        totalItems: true,
        expectedAt: true,
        note: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: skip,
      take: limit,
    });

    const countReceives = await this.prisma.receiveInventory.count({
      where: whereCondition,
    });

    const totalPage = Math.ceil(countReceives / limit);

    return res.json({
      receiveInventory: receives,
      paginition: {
        total: totalPage,
        count: countReceives,
        page: page,
        limit: limit,
      },
    });
  }

  async getDetail(receiveId: number, res: Response) {
    try {
      const data = await this.prisma.receiveInventory.findUnique({
        where: {
          id: receiveId,
        },
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
                select: {
                  name: true,
                },
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
            orderBy: {
              createdAt: 'desc',
            },
          },
          receiveLandedCosts: {
            select: {
              id: true,
              name: true,
              price: true,
            },
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
                    select: {
                      id: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
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
      return res.json({ ...data, tags: tags });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async import(dto: ImportItemDTO, req, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          // Tạo lịch sử đơn nhập
          await p.receiveHistory.create({
            data: {
              type: ReceiveHistoryType.RECEIVE,
              action: ReceiveHistoryAction.RECEIVED,
              changedUserId: req.user.id,
              receiveId: dto.receiveId,
            },
          });

          for (const item of dto.importItems) {
            await p.receiveItem.update({
              where: {
                id: item.itemId,
              },
              data: {
                quantityReceived: {
                  increment: item.importQuantity,
                },
                quantityRemain: {
                  decrement: item.importQuantity,
                },
              },
            });
            // Cập nhật tồn kho
            const inventory = await p.inventory.findFirst({
              where: {
                variant_id: item.variantId,
                warehouse_id: dto.warehouseId,
              },
            });
            if (inventory) {
              await p.inventory.update({
                where: {
                  id: inventory.id,
                },
                data: {
                  onHand: {
                    increment: item.importQuantity,
                  },
                  avaiable: {
                    increment: item.importQuantity,
                  },
                  onReceive: {
                    decrement: item.importQuantity,
                  },
                  histories: {
                    create: {
                      transactionAction: InventoryTransactionAction.RECEIPT,
                      transactionType:
                        InventoryTransactionType.RECEIVE_INVENTORY,
                      onHandQuantityChange: item.importQuantity,
                      avaiableQuantityChange: item.importQuantity,
                      onReceiveQuantityChange: item.importQuantity * -1,
                      newOnHand: inventory.onHand + item.importQuantity,
                      newAvaiable: inventory.avaiable + item.importQuantity,
                      newOnReceive: inventory.onReceive - item.importQuantity,
                      changeUserId: req.user.id,
                      receiveInventoryId: dto.receiveId,
                    },
                  },
                },
              });
            }
          }
          // Kiểm tra đơn nhập còn hàng chưa nhập hay không
          const items = await p.receiveItem.findMany({
            where: {
              receiveId: dto.receiveId,
            },
            select: {
              quantityRemain: true,
            },
          });
          let isFullReceive = true;
          for (const i of items) {
            if (i.quantityRemain > 0) {
              isFullReceive = false;
              break;
            }
          }
          if (isFullReceive) {
            await p.receiveInventory.update({
              where: {
                id: dto.receiveId,
              },
              data: {
                status: ReceiveInventoryStatus.RECEIVED,
              },
            });
          } else {
            await p.receiveInventory.update({
              where: {
                id: dto.receiveId,
              },
              data: {
                status: ReceiveInventoryStatus.PARTIALLY_RECEIVED,
              },
            });
          }
        },
        {
          maxWait: 10000,
          timeout: 10000,
        },
      );
      return res.json({ message: 'Đã cập nhật tồn kho ' });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async processPayment(dto: ProcessPaymentDTO, req, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          // Cập nhật giá tiền cần trả NCC
          const updateReceive = await p.receiveInventory.update({
            where: {
              id: dto.receiveId,
            },
            data: {
              transactionRemainAmount: {
                decrement: dto.transactionAmount,
              },
              transactionStatus: ReceiveInventoryTransaction.PARTIALLY_PAID,
            },
          });

          // Nếu đã thanh toán hết sẽ cập nhật trạng thái thanh toán
          console.log('>>>', updateReceive.transactionRemainAmount);

          if (updateReceive.transactionRemainAmount === 0) {
            await p.receiveInventory.update({
              where: {
                id: dto.receiveId,
              },
              data: {
                transactionStatus: ReceiveInventoryTransaction.PAID,
              },
            });
          }

          // Tạo lịch sử thanh toán - Tạo lịch sử đơn nhập
          await p.receiveTransaction.create({
            data: {
              amount: dto.transactionAmount,
              paymentMethod: dto.transactionMethod,
              processedAt: dto.transactionDate,
              receiveId: dto.receiveId,
              receiveHistory: {
                create: {
                  action: ReceiveHistoryAction.PAID,
                  type: ReceiveHistoryType.PAID,
                  changedUserId: req.user.id,
                  receiveId: dto.receiveId,
                },
              },
            },
          });
        },
        {
          maxWait: 10000,
          timeout: 10000,
        },
      );
      return res.json({ message: 'Cập nhật đơn nhập thành công' });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async cancel(dto: CancelReceiveInventoryDTO, req, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          // Cập nhật đơn nhập - Thêm lịch sử đơn nhập
          const updateReceive = await p.receiveInventory.update({
            where: {
              id: dto.receiveId,
            },
            data: {
              status: ReceiveInventoryStatus.CANCEL,
              receiveHistories: {
                create: {
                  action: ReceiveHistoryAction.CANCELLED,
                  type: ReceiveHistoryType.RECEIVE,
                  changedUserId: req.user.id,
                },
              },
            },
          });

          // Cập nhật hàng đang về và tồn kho (nếu hoàn trả)
          const items = await p.receiveItem.findMany({
            where: {
              receiveId: dto.receiveId,
            },
          });

          for (const item of items) {
            const inventory = await p.inventory.findFirst({
              where: {
                variant_id: item.variantId,
                warehouse_id: updateReceive.warehouseId,
              },
            });
            if (item.quantityRemain > 0 && inventory) {
              // Nếu hoàn trả hàng nhập
              if (dto.returnItem) {
                await p.inventory.update({
                  where: {
                    id: inventory.id,
                  },
                  data: {
                    onHand: {
                      decrement: item.quantityReceived,
                    },
                    avaiable: {
                      decrement: item.quantityReceived,
                    },
                    onReceive: {
                      decrement: item.quantityRemain,
                    },
                    histories: {
                      create: {
                        transactionAction:
                          InventoryTransactionAction.RECEIVE_CANCEL,
                        transactionType:
                          InventoryTransactionType.RECEIVE_INVENTORY,
                        newOnHand: inventory.onHand - item.quantityReceived,

                        newAvaiable: inventory.onHand - item.quantityReceived,
                        newOnReceive: inventory.onReceive - item.quantityRemain,
                        onHandQuantityChange: item.quantityReceived * -1,
                        avaiableQuantityChange: item.quantityReceived * -1,
                        onReceiveQuantityChange: item.quantityRemain * -1,
                        changeUserId: req.user.id,
                        receiveInventoryId: dto.receiveId,
                      },
                    },
                  },
                });
              } else {
                await p.inventory.update({
                  where: {
                    id: inventory.id,
                  },
                  data: {
                    onReceive: {
                      decrement: item.quantityRemain,
                    },
                    histories: {
                      create: {
                        transactionAction:
                          InventoryTransactionAction.RECEIVE_CANCEL,
                        transactionType:
                          InventoryTransactionType.RECEIVE_INVENTORY,
                        newOnReceive: inventory.onReceive - item.quantityRemain,
                        onReceiveQuantityChange: item.quantityRemain * -1,
                        changeUserId: req.user.id,
                        receiveInventoryId: dto.receiveId,
                      },
                    },
                  },
                });
              }
            }
          }
        },
        {
          maxWait: 10000,
          timeout: 10000,
        },
      );

      return res.json({ message: 'Đã hủy đơn nhập' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error);
    }
  }

  async delete(id: number, req, res: Response) {
    try {
      await this.prisma.$transaction(async (p) => {
        await p.receiveInventory.update({
          where: {
            id: id,
          },
          data: {
            void: true,
            receiveHistories: {
              create: {
                action: ReceiveHistoryAction.DELETE,
                type: ReceiveHistoryType.RECEIVE,
                changedUserId: req.user.id,
              },
            },
          },
        });
      });

      return res.json({ message: 'Xóa đơn nhập thành công' });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
