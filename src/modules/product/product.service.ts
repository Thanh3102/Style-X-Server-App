import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCategoryDTO,
  CreateCollectionDTO,
  CreateProductDTO,
  PublicProductParams,
  UpdateCategoryDTO,
  UpdateCollectionDTO,
  UpdateProductDTO,
  UpdateVariantDTO,
} from './product';
import { Response } from 'express';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
  QueryParams,
} from 'src/utils/types';
import { TagType } from '../tags/tag.type';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { InventoriesService } from '../inventories/inventories.service';
import { isInteger } from 'src/utils/helper/StringHelper';
import { DiscountService } from '../discount/discount.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private inventoriesService: InventoriesService,
    private discountService: DiscountService,
  ) {}

  private tagType = TagType.PRODUCT;

  private checkCreateProductConflict = async (dto: CreateProductDTO) => {
    if (
      await this.prisma.product.findFirst({
        select: { id: true },
        where: { name: dto.name },
      })
    )
      throw new BadRequestException('Tên sản phẩm đã được sử dụng');
  };

  private checkValidProductId = async (id: number) => {
    const product = await this.prisma.product.findUnique({
      where: {
        id: id,
      },
      select: {
        void: true,
      },
    });

    if (!product) throw new Error('Sản phẩm không tồn tại');
    if (product.void) throw new Error('Sản phẩm đã bị xóa');
  };

  public getInventoryStock = async (productId: number) => {
    const result = await this.prisma.inventory.aggregate({
      _sum: {
        avaiable: true,
        onHand: true,
        onReceive: true,
        onTransaction: true,
      },
      where: {
        productVariant: {
          productId: productId,
        },
      },
    });

    return result._sum;
  };

  public getVariantInventoryStock = async (variantId: number) => {
    const result = await this.prisma.inventory.aggregate({
      _sum: {
        avaiable: true,
        onHand: true,
        onReceive: true,
        onTransaction: true,
      },
      where: {
        variant_id: variantId,
      },
    });

    return result._sum;
  };

  public getProductOptions = async (productId: number, short?: boolean) => {
    const productProperties = await this.prisma.productProperties.findMany({
      where: {
        productId: productId,
      },
      select: {
        id: true,
        name: true,
        position: true,
        values: {
          select: {
            value: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });

    if (short) {
      const options = productProperties.map((pp) => {
        return {
          name: pp.name,
          values: pp.values.map((v) => v.value),
        };
      });

      return options;
    }

    const options = productProperties.map((pp) => {
      return {
        ...pp,
        values: pp.values.map((v) => v.value),
      };
    });

    return options;
  };

  private getProductImages = async (productId: number) => {
    const productImages = await this.prisma.productImages.findMany({
      where: {
        productId: productId,
      },
      select: {
        url: true,
        publicId: true,
      },
    });

    return productImages;
  };

  private getProductVariants = async (productId: number) => {
    const productVariants = await this.prisma.productVariants.findMany({
      where: {
        productId: productId,
        void: false,
      },
      select: {
        title: true,
        id: true,
        barCode: true,
        skuCode: true,
        comparePrice: true,
        costPrice: true,
        sellPrice: true,
        unit: true,
        option1: true,
        option2: true,
        option3: true,
        image: true,
        inventories: {
          select: {
            id: true,
            avaiable: true,
            onHand: true,
            onTransaction: true,
            onReceive: true,
            warehouse: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return productVariants;
  };

  public getProductPublicVariants = async (productId: number) => {
    const productVariants = await this.prisma.productVariants.findMany({
      where: {
        productId: productId,
        void: false,
      },
      select: {
        id: true,
        title: true,
        comparePrice: true,
        sellPrice: true,
        unit: true,
        option1: true,
        option2: true,
        option3: true,
        image: true,
        inventories: {
          select: {
            avaiable: true,
          },
        },
      },
    });
    const activeProductPromotions =
      await this.discountService.getActiveDiscounts({
        mode: ['promotion'],
        type: ['product'],
      });
    const tranformProductVariants = [];

    for (const variant of productVariants) {
      const { inventories, ...returnData } = variant;
      const avaiable = variant.inventories.reduce(
        (total, i) => total + i.avaiable,
        0,
      );
      const discountInfo = await this.discountService.calcVariantDiscount(
        variant,
        activeProductPromotions,
      );
      tranformProductVariants.push({
        ...returnData,
        ...discountInfo,
        avaiable,
      });
    }
    return tranformProductVariants;
  };

  private getProductCategories = async (productId: number) => {
    const productCategories = await this.prisma.productCategory.findMany({
      where: {
        productId: productId,
      },
      select: {
        category: {
          select: {
            id: true,
            title: true,
            collection: true,
          },
        },
      },
    });

    const categories = productCategories.map((pcat) => {
      return {
        id: pcat.category.id,
        title: pcat.category.title,
        collection: pcat.category.collection,
      };
    });

    return categories;
  };

  private getProductTags = async (productId: number) => {
    const productTags = await this.prisma.productTag.findMany({
      where: {
        productId: productId,
      },
      select: {
        tags: {
          select: {
            name: true,
          },
        },
      },
    });

    const tags = productTags.map((pTag) => {
      return pTag.tags.name;
    });

    return tags;
  };

  async get(queryParams: QueryParams, res: Response) {
    const {
      page: pg,
      limit: lim,
      query,
      createdOn,
      createdOnMax,
      createdOnMin,
      assignIds,
    } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 10;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    let condition = {
      query: {},
      created: {},
      assignedIds: {},
      default: {
        void: false,
      },
    };

    if (query) {
      condition.query = {
        OR: [
          {
            name: {
              contains: query,
            },
          },
          {
            skuCode: {
              contains: query,
            },
          },
          {
            barCode: {
              contains: query,
            },
          },
        ],
      };
    }

    let whereCondition = {
      ...condition.default,
      ...condition.query,
      ...condition.created,
      ...condition.assignedIds,
    };

    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        barCode: true,
        skuCode: true,
        comparePrice: true,
        sellPrice: true,
        costPrice: true,
        image: true,
        type: true,
        vendor: true,
        createdAt: true,
        variants: {
          select: {
            id: true,
            productId: true,
            skuCode: true,
            barCode: true,
            unit: true,
            comparePrice: true,
            sellPrice: true,
            costPrice: true,
            image: true,
            option1: true,
            option2: true,
            option3: true,
            title: true,
            createdAt: true,
          },
          where: {
            void: false,
          },
        },
      },
      where: whereCondition,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: skip,
    });

    const countProduct = await this.prisma.product.count({
      where: whereCondition,
    });

    const totalPage = Math.floor(countProduct / limit);

    const responseProducts = [];

    for (const product of products) {
      const stock = await this.getInventoryStock(product.id);
      const variantsWithStock = [];
      for (const variant of product.variants) {
        const variantStock = await this.getVariantInventoryStock(variant.id);
        variantsWithStock.push({
          ...variant,
          avaiable: variantStock.avaiable,
          onHand: variantStock.onHand,
          onTransaction: variantStock.onTransaction,
          onReceive: variantStock.onReceive,
        });
      }
      responseProducts.push({
        ...product,
        avaiable: stock.avaiable,
        onHand: stock.onHand,
        onTransaction: stock.onTransaction,
        onReceive: stock.onReceive,
        variants: variantsWithStock,
      });
    }

    return res.status(200).json({
      products: responseProducts,
      paginition: {
        total: countProduct % limit == 0 ? totalPage : totalPage + 1,
        count: countProduct,
        page: page,
        limit: limit,
      },
    });
  }

  async getVariants(queryParams: QueryParams, res: Response) {
    const { page: pg, limit: lim, query } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 10;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    let whereCondition: any = {
      void: false,
    };

    if (query) {
      whereCondition.OR = [
        {
          product: {
            name: {
              contains: query,
            },
          },
        },
        {
          title: {
            contains: query,
          },
        },
        {
          skuCode: {
            contains: query,
          },
        },
        {
          barCode: {
            contains: query,
          },
        },
      ];
    }

    const variants = await this.prisma.productVariants.findMany({
      select: {
        id: true,
        skuCode: true,
        barCode: true,
        unit: true,
        comparePrice: true,
        sellPrice: true,
        costPrice: true,
        image: true,
        option1: true,
        option2: true,
        option3: true,
        title: true,
        createdAt: true,

        product: {
          select: {
            id: true,
            name: true,
            barCode: true,
            skuCode: true,
            comparePrice: true,
            sellPrice: true,
            costPrice: true,
            image: true,
            createdAt: true,
          },
        },
      },
      where: whereCondition,

      orderBy: {
        createdAt: 'desc',
        productId: 'desc',
      },
      take: limit,
      skip: skip,
    });

    const countVariants = await this.prisma.productVariants.count({
      where: whereCondition,
    });

    const totalPage = Math.floor(countVariants / limit);

    const responseVariants = [];

    for (const variant of variants) {
      const stock = await this.getVariantInventoryStock(variant.id);
      responseVariants.push({
        ...variant,
        avaiable: stock.avaiable,
        onHand: stock.onHand,
        onTransaction: stock.onTransaction,
        onReceive: stock.onReceive,
      });
    }

    return res.status(200).json({
      variants: responseVariants,
      paginition: {
        total: countVariants % limit == 0 ? totalPage : totalPage + 1,
        count: countVariants,
        page: page,
        limit: limit,
      },
    });
  }

  async getDetail(id: number, res: Response) {
    try {
      await this.checkValidProductId(id);
      const product = await this.prisma.product.findUnique({
        where: {
          id: id,
        },
        select: {
          id: true,
          name: true,
          barCode: true,
          skuCode: true,
          avaiable: true,
          comparePrice: true,
          costPrice: true,
          sellPrice: true,
          type: true,
          unit: true,
          description: true,
          shortDescription: true,
          image: true,
        },
      });

      const options = await this.getProductOptions(product.id);
      const images = await this.getProductImages(product.id);
      const variants = await this.getProductVariants(product.id);
      const categories = await this.getProductCategories(product.id);
      const tags = await this.getProductTags(product.id);

      return res.status(200).json({
        ...product,
        images,
        variants,
        options,
        categories,
        tags,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getVariantDetail(variantId: number) {
    try {
      const variant = await this.prisma.productVariants.findUnique({
        where: {
          id: variantId,
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      const variantWarehouses =
        await this.inventoriesService.getVariantWarehouses(variantId);

      return { ...variant, warehouses: variantWarehouses };
    } catch (error) {
      console.log(error);
      throw new BadRequestException(error);
    }
  }

  async create(dto: CreateProductDTO, req, res: Response) {
    const requestUserId = req.user.id;
    try {
      await this.checkCreateProductConflict(dto);

      const skuCode = dto.skuCode
        ? dto.skuCode
        : await generateCustomID('SKU', 'product', 'skuCode');

      const { id: createProductId } = await this.prisma.$transaction(
        async (p) => {
          const createdProduct = await p.product.create({
            data: {
              name: dto.name,
              barCode: dto.barCode,
              skuCode: skuCode,
              avaiable: dto.avaiable,
              comparePrice: dto.comparePrice,
              costPrice: dto.costPrice,
              sellPrice: dto.sellPrice,
              description: dto.description,
              shortDescription: dto.shortDescription,
              unit: dto.unit,
              vendor: dto.vendor,
              type: dto.type,
              createdUserId: req.user.id,
              updatedUserId: req.user.id,
            },
            select: {
              id: true,
            },
          });

          // Tạo các property
          for (const property of dto.options) {
            await p.productProperties.create({
              data: {
                name: property.name,
                position: parseInt(property.position),
                productId: createdProduct.id,
                values: {
                  createMany: {
                    data: [
                      ...property.values.map((v) => {
                        return { value: v };
                      }),
                    ],
                  },
                },
              },
            });
          }

          // Tạo variant và kho
          if (dto.variants.length === 0) {
            const defaultVariant = await p.productVariants.create({
              data: {
                title: 'Default Title',
                barCode: dto.barCode,
                skuCode: skuCode,
                comparePrice: dto.comparePrice,
                sellPrice: dto.sellPrice,
                costPrice: dto.costPrice,
                unit: dto.unit,
                productId: createdProduct.id,
              },
              select: {
                id: true,
              },
            });

            for (const warehouse of dto.warehouses) {
              await p.inventory.create({
                data: {
                  variant_id: defaultVariant.id,
                  warehouse_id: warehouse.id,
                  avaiable: warehouse.onHand,
                  onHand: warehouse.onHand,
                  histories: {
                    create: {
                      avaiableQuantityChange: warehouse.onHand,
                      newAvaiable: warehouse.onHand,
                      onHandQuantityChange: warehouse.onHand,
                      newOnHand: warehouse.onHand,
                      transactionType: InventoryTransactionType.PRODUCT,
                      transactionAction:
                        InventoryTransactionAction.INITIAL_SETUP,
                      changeUserId: requestUserId,
                    },
                  },
                },
              });
            }
          } else {
            for (const { warehouses, ...data } of dto.variants) {
              const variant = await p.productVariants.create({
                data: {
                  ...data,
                  productId: createdProduct.id,
                  skuCode: dto.skuCode
                    ? data.skuCode
                    : `${skuCode}-${data.skuCode}`,
                },
                select: {
                  id: true,
                },
              });

              for (const warehouse of warehouses) {
                await p.inventory.create({
                  data: {
                    variant_id: variant.id,
                    warehouse_id: warehouse.id,
                    avaiable: warehouse.onHand,
                    onHand: warehouse.onHand,
                    histories: {
                      create: {
                        avaiableQuantityChange: warehouse.onHand,
                        newAvaiable: warehouse.onHand,
                        onHandQuantityChange: warehouse.onHand,
                        newOnHand: warehouse.onHand,
                        transactionType: InventoryTransactionType.PRODUCT,
                        transactionAction:
                          InventoryTransactionAction.INITIAL_SETUP,
                        changeUserId: requestUserId,
                      },
                    },
                  },
                });
              }
            }
          }

          // Cập nhật tag
          const allProductTags = await p.tag.findMany({
            select: {
              id: true,
              name: true,
            },
            where: {
              type: this.tagType,
            },
          });

          for (let dtoTag of dto.tags) {
            const findTag = allProductTags.find((tag) => tag.name === dtoTag);
            if (findTag) {
              await p.productTag.create({
                data: {
                  productId: createdProduct.id,
                  tagId: Number(findTag.id),
                },
              });
            } else {
              await p.tag.create({
                data: {
                  name: dtoTag,
                  type: this.tagType,
                  productTags: {
                    create: {
                      productId: createdProduct.id,
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

          // Cập nhật category
          await p.productCategory.createMany({
            data: [
              ...dto.categoryIds.map((catId) => {
                return { categoryId: catId, productId: createdProduct.id };
              }),
            ],
          });

          // Lưu ảnh
          let isMainImage = true;
          for (const image of dto.images) {
            await this.cloudinary
              .uploadFile(image, { folder: `StyleX` })
              .then(async (res) => {
                const { url } = await p.productImages.create({
                  data: {
                    assetId: res.asset_id,
                    publicId: res.public_id,
                    bytes: image.size,
                    url: res.secure_url,
                    productId: createdProduct.id,
                  },
                });
                if (isMainImage) {
                  await p.product.update({
                    where: {
                      id: createdProduct.id,
                    },
                    data: {
                      image: url,
                    },
                  });
                }
              });
            isMainImage = false;
          }

          return createdProduct;
        },
        {
          timeout: 30000,
          maxWait: 10000,
        },
      );

      return res.status(200).json({ id: createProductId });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async createCategory(dto: CreateCategoryDTO, req, res: Response) {
    try {
      const isTitleExist = await this.prisma.category.findFirst({
        where: {
          title: dto.title,
          collectionId: parseInt(dto.collectionId),
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.category.findFirst({
        where: {
          slug: dto.slug,
          collectionId: parseInt(dto.collectionId),
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      await this.prisma.$transaction(
        async (p) => {
          const createdCategory = await p.category.create({
            data: {
              title: dto.title,
              slug: dto.slug,
              collectionId: parseInt(dto.collectionId),
            },
          });

          if (dto.image) {
            const { secure_url, public_id } = await this.cloudinary.uploadFile(
              dto.image,
            );

            await p.category.update({
              where: {
                id: createdCategory.id,
              },
              data: {
                image: secure_url,
                imagePublicId: public_id,
              },
            });
          }
        },
        {
          maxWait: 10000,
          timeout: 10000,
        },
      );

      return res.status(200).json({ message: 'Tạo danh mục thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateCategory(dto: UpdateCategoryDTO, req, res: Response) {
    try {
      const isTitleExist = await this.prisma.category.findFirst({
        where: {
          title: dto.title,
          id: {
            not: parseInt(dto.id),
          },
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.category.findFirst({
        where: {
          slug: dto.slug,
          id: {
            not: parseInt(dto.id),
          },
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      await this.prisma.$transaction(
        async (p) => {
          const updatedCategory = await p.category.update({
            where: {
              id: parseInt(dto.id),
            },
            data: {
              title: dto.title,
              slug: dto.slug,
            },
          });

          if (dto.image) {
            await this.cloudinary.deleteFile(updatedCategory.imagePublicId);
            const { secure_url, public_id } = await this.cloudinary.uploadFile(
              dto.image,
            );

            await p.category.update({
              where: {
                id: updatedCategory.id,
              },
              data: {
                image: secure_url,
                imagePublicId: public_id,
              },
            });
          }
        },
        {
          maxWait: 10000,
          timeout: 10000,
        },
      );

      return res.status(200).json({ message: 'Cập nhật danh mục thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async deleteCategory(id: number, res: Response) {
    try {
      await this.prisma.$transaction(async (p) => {
        await p.productCategory.deleteMany({
          where: {
            categoryId: id,
          },
        });

        const deleteCategory = await p.category.delete({
          where: {
            id: id,
          },
        });

        await this.cloudinary.deleteFile(deleteCategory.imagePublicId);
      });
      return res.json({ message: 'Đã xóa danh mục' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getCollection(res: Response) {
    try {
      const collections = await this.prisma.collection.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          categories: {
            select: {
              id: true,
              image: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: {
          title: 'desc',
        },
      });
      return res.status(200).json(collections);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async createCollection(dto: CreateCollectionDTO, req, res: Response) {
    try {
      const collections = await this.prisma.collection.findMany();
      if (collections.length >= 5)
        return res
          .status(400)
          .json({ message: 'Số lượng bộ sưu tập đã đạt tối đa' });

      const isTitleExist = await this.prisma.collection.findUnique({
        where: {
          title: dto.title,
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.collection.findUnique({
        where: {
          slug: dto.slug,
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      const { _max } = await this.prisma.collection.aggregate({
        _max: {
          position: true,
        },
      });

      const createdCollection = await this.prisma.collection.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          position: _max.id ? _max.id + 1 : 1,
        },
      });

      return res.status(200).json({ message: 'Thêm thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateCollection(dto: UpdateCollectionDTO, req, res: Response) {
    try {
      const isTitleExist = await this.prisma.collection.findFirst({
        where: {
          title: dto.title,
          id: {
            not: parseInt(dto.id),
          },
        },
      });

      if (isTitleExist)
        return res.status(400).json({ message: 'Tiêu đề đã tồn tại' });

      const isSlugExist = await this.prisma.collection.findFirst({
        where: {
          slug: dto.slug,
          id: {
            not: parseInt(dto.id),
          },
        },
      });

      if (isSlugExist)
        return res.status(400).json({ message: 'Đường dẫn đã tồn tại' });

      const updatedCategory = await this.prisma.collection.update({
        where: {
          id: parseInt(dto.id),
        },
        data: {
          title: dto.title,
          slug: dto.slug,
        },
      });

      return res.status(200).json({ message: 'Cập nhật thành công' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async deleteCollection(id: number, res: Response) {
    try {
      await this.prisma.$transaction(async (p) => {
        const deleteCollection = await p.collection.delete({
          where: {
            id: id,
          },
        });

        const collections = await this.prisma.collection.findMany();

        for (const collection of collections) {
          if (collection.position > deleteCollection.position) {
            await this.prisma.collection.update({
              where: {
                id: collection.id,
              },
              data: {
                position: {
                  decrement: 1,
                },
              },
            });
          }
        }
      });
      return res.json({ message: 'Đã xóa bộ sưu tập' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getCategories(queryParams: QueryParams) {
    const { query } = queryParams;

    let conditions = {
      query: {},
    };

    if (query) {
      conditions.query = {
        title: {
          startsWith: query,
        },
      };
    }

    const whereCondition = {
      ...conditions.query,
    };

    const categories = await this.prisma.category.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        image: true,
        collection: true,
      },
      where: whereCondition,
      orderBy: {
        title: 'asc',
      },
      // take: 10,
      // skip: 0,
    });

    return categories;
  }

  async updateMainImage(productId: number, image: string, res: Response) {
    try {
      await this.prisma.product.update({
        data: {
          image: image,
        },
        where: {
          id: productId,
        },
      });
      return res
        .status(200)
        .json({ message: 'Cập nhật ảnh đại diện thành công' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message ?? 'Đã xảy ra lỗi');
    }
  }

  async deleteImage(url: string, publicId: string, res: Response) {
    try {
      await this.prisma.$transaction(async (p) => {
        const {
          product: { id, image },
        } = await p.productImages.findUnique({
          where: {
            publicId: publicId,
          },
          select: {
            product: {
              select: {
                id: true,
                image: true,
              },
            },
          },
        });

        if (url === image) {
          await p.product.update({
            where: {
              id: id,
            },
            data: {
              image: null,
            },
          });
        }

        await p.productImages.delete({
          where: {
            publicId: publicId,
          },
        });
      });

      await this.cloudinary.deleteFile(publicId);

      return res.status(200).json({ message: 'Đã xóa ảnh' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message ?? 'Đã xảy ra lỗi');
    }
  }

  async addImage(
    productId: number,
    images: Array<Express.Multer.File>,
    res: Response,
  ) {
    const uploadedPublicId = [];
    try {
      await this.prisma.$transaction(
        async (p) => {
          for (const img of images) {
            const result = await this.cloudinary.uploadFile(img);
            await p.productImages.create({
              data: {
                url: result.secure_url,
                publicId: result.public_id,
                assetId: result.asset_id,
                bytes: img.size,
                productId: productId,
              },
            });
          }
        },
        { maxWait: 60000, timeout: 60000 },
      );

      return res.status(200).json({ message: 'Thêm ảnh thành công' });
    } catch (error) {
      for (const publicId of uploadedPublicId) {
        this.cloudinary.deleteFile(publicId);
      }
      console.log(error);
      throw new InternalServerErrorException(
        error.message ?? 'Đã xảy ra lỗi khi thêm ảnh',
      );
    }
  }

  async update(dto: UpdateProductDTO, req, res: Response) {
    const updateUserId = req.user.id;
    try {
      await this.prisma.$transaction(
        async (p) => {
          // Update product
          await p.product.update({
            where: {
              id: dto.id,
            },
            data: {
              name: dto.name,
              description: dto.description,
              shortDescription: dto.shortDescription,
              avaiable: dto.avaiable,
              type: dto.type,
              vendor: dto.vendor,
              updatedUserId: updateUserId,
              sellPrice: dto.sellPrice,
              comparePrice: dto.comparePrice,
              costPrice: dto.comparePrice,
            },
          });
          // Update product category

          // Add category
          for (const categoryId of dto.addCategoryIds) {
            await p.productCategory.create({
              data: {
                categoryId: categoryId,
                productId: dto.id,
              },
            });
          }

          // Delete category not use
          await p.productCategory.deleteMany({
            where: {
              productId: dto.id,
              categoryId: {
                in: dto.deleteCategoryIds,
              },
            },
          });

          // Add tag
          const allProductTags = await p.tag.findMany({
            where: {
              type: this.tagType,
            },
            select: {
              id: true,
              name: true,
            },
          });

          for (const tag of dto.addTags) {
            // Check if this tag exist
            const findTag = allProductTags.find((pTag) => pTag.name === tag);
            if (findTag) {
              await p.productTag.create({
                data: {
                  productId: dto.id,
                  tagId: findTag.id,
                },
              });
              await p.tag.update({
                data: {
                  lastUsedAt: new Date(),
                },
                where: {
                  id: findTag.id,
                },
              });
            } else {
              // Create new product tag
              await p.tag.create({
                data: {
                  name: tag,
                  type: this.tagType,
                },
              });
            }
          }

          // Delete product tag not use
          const deleteTags = allProductTags.filter((pTag) =>
            dto.deleteTags.includes(pTag.name),
          );
          await p.productTag.deleteMany({
            where: {
              productId: dto.id,
              tagId: {
                in: deleteTags.map((tag) => tag.id),
              },
            },
          });
        },
        { timeout: 10000 },
      );
      return res.status(200).json({ message: 'Cập nhật thông tin thành công' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        error.message ?? 'Đã xảy ra lỗi khi cập nhật thông tin sản phẩm',
      );
    }
  }

  async updateVariant(dto: UpdateVariantDTO, res: Response) {
    try {
      await this.prisma.$transaction(
        async (p) => {
          await p.productVariants.update({
            where: {
              id: dto.variantId,
            },
            data: {
              barCode: dto.barCode,
              skuCode: dto.skuCode,
              sellPrice: dto.sellPrice,
              comparePrice: dto.comparePrice,
              costPrice: dto.costPrice,
              unit: dto.unit,
            },
          });
        },
        {
          timeout: 10000,
        },
      );

      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        error.message ?? 'Đã xảy ra lỗi khi cập nhật phiên bản',
      );
    }
  }

  private tranformPublicProductParamsToQuery = async (
    params: PublicProductParams,
  ) => {
    const { query, category, slug, sort, priceRange } = params;
    let where: Prisma.ProductWhereInput = {
      avaiable: true,
    };
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};

    if (query) {
      where.name = {
        startsWith: query,
      };
    }

    if (slug) {
      where.productCategories = where.productCategories || {};
      where.productCategories.some = where.productCategories.some || {};
      where.productCategories.some.category =
        where.productCategories.some.category || {};

      where.productCategories.some.category.collection =
        where.productCategories.some.category.collection || {};
      where.productCategories.some.category.collection.slug = slug;
    }

    if (category) {
      where.productCategories = where.productCategories || {};
      where.productCategories.some = where.productCategories.some || {};
      where.productCategories.some.category =
        where.productCategories.some.category || {};

      where.productCategories.some.category.slug = category;
    }

    // if (priceRange) {
    //   const [min, max] = priceRange.split('-');
    //   const maxValue = isInteger(max) ? parseInt(max) : 1e12;
    //   const minValue = isInteger(min) ? parseInt(min) : 0;

    //   where.sellPrice = {
    //     gte: minValue,
    //     lte: maxValue,
    //   };
    // }

    console.log('Where', where);

    return { where, orderBy };
  };

  async getProductPublic(
    where: Prisma.ProductWhereInput,
    order: Prisma.ProductOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    try {
      const basicProducts = await this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          image: true,
          // sellPrice: true,
          // comparePrice: true,
          createdAt: true,
          updatedAt: true,
          productCategories: {
            select: {
              categoryId: true,
            },
          },
        },
        where: where,
        orderBy: order,
        take: take,
        skip: skip,
      });

      return basicProducts;
    } catch (error) {
      console.log(error);
      throw new Error(error);
    }
  }

  async fetchProductPublic(params: PublicProductParams, res: Response) {
    try {
      const { page: pg, limit: lim, priceRange } = params;

      let page = 1;
      let limit = 20;

      if (isInteger(pg)) page = parseInt(pg);
      if (isInteger(lim)) limit = parseInt(lim);

      const skip = page === 1 ? 0 : (page - 1) * limit;

      const { where, orderBy } =
        await this.tranformPublicProductParamsToQuery(params);

      const basicProducts = await this.getProductPublic(
        where,
        orderBy,
        skip,
        limit,
      );

      const products = [];

      // const activeProductPromotions =
      //   await this.discountService.getActiveDiscounts('promotion', 'product');

      for (const product of basicProducts) {
        const { productCategories, ...rest } = product;
        // Lấy các thông tin về tùy chọn, danh mục, phiên bản
        const categoryIds = productCategories.map((item) => item.categoryId);
        const options = await this.getProductOptions(product.id);
        const variants = await this.getProductPublicVariants(product.id);

        // const { discountPrice, applyPromotions } =
        //   await this.discountService.calcProductDiscount(
        //     product,
        //     activeProductPromotions,
        //   );

        products.push({
          ...rest,
          categoryIds,
          options,
          variants: variants,
        });
      }

      const count = await this.prisma.product.count({
        where: where,
      });

      const totalPage = Math.floor(count / limit);

      return res.status(200).json({
        data: products,
        total: count,
        limit: limit,
        currentPage: page,
        lastPage: count % limit == 0 ? totalPage : totalPage + 1,
      });
    } catch (e) {
      console.log(e);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async getProductDetailPublic(id: number) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: id,
        avaiable: true,
      },
      select: {
        id: true,
        name: true,
        skuCode: true,
        comparePrice: true,
        sellPrice: true,
        type: true,
        unit: true,
        description: true,
        shortDescription: true,
        image: true,
        productCategories: true,
      },
    });
    const options = await this.getProductOptions(product.id);
    const images = await this.getProductImages(product.id);
    const variants = await this.getProductPublicVariants(product.id);

    return { ...product, options, images, variants };
  }

  async fetchProductDetailPublic(id: number, res: Response) {
    try {
      await this.checkValidProductId(id);

      const product = await this.getProductDetailPublic(id);

      const sameCategoryBasicProduct = await this.getProductPublic(
        {
          void: false,
          avaiable: true,
          id: {
            not: id,
          },
          productCategories: {
            some: {
              categoryId: {
                in: product.productCategories.map((item) => item.categoryId),
              },
            },
          },
        },
        {},
        0,
        24,
      );

      const sameCategoryProduct = [];

      // const activeProductPromotions =
      //   await this.discountService.getActiveDiscounts('promotion', 'product');

      for (const product of sameCategoryBasicProduct) {
        const { productCategories, ...rest } = product;
        // Lấy các thông tin về tùy chọn, danh mục, phiên bản
        const categoryIds = productCategories.map((item) => item.categoryId);
        const options = await this.getProductOptions(product.id);
        const variants = await this.getProductPublicVariants(product.id);

        // const { discountPrice, applyPromotions } =
        //   await this.discountService.calcProductDiscount(
        //     product,
        //     activeProductPromotions,
        //   );

        sameCategoryProduct.push({
          ...rest,
          categoryIds,
          options,
          variants: variants,
        });
      }

      return res.status(200).json({
        ...product,
        sameCategoryProducts: sameCategoryProduct,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async getCollectionDetail(slug: string, res: Response) {
    try {
      const collection = await this.prisma.collection.findUnique({
        where: {
          slug: slug,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          categories: {
            select: {
              id: true,
              slug: true,
              image: true,
              title: true,
            },
          },
        },
      });

      return res.status(200).json(collection);
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async searchProductPublic(query: string, res: Response) {
    try {
      const products = await this.getProductPublic(
        {
          name: {
            startsWith: query,
          },
        },
        { name: 'asc' },
        undefined,
        undefined,
      );

      const categories = await this.prisma.category.findMany({
        where: {
          title: {
            startsWith: query,
          },
        },
        include: {
          collection: true,
        },
      });

      return res
        .status(200)
        .json({ products: products, categories: categories });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

}
