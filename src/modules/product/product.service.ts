import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateCategoryDTO,
  CreateProductDTO,
  UpdateProductDTO,
  UpdateVariantDTO,
} from './product';
import { Response } from 'express';
import {
  InventoryProductTransactionAction,
  InventoryTransactionType,
  QueryParams,
} from 'src/utils/types';
import { TagType } from '../tags/tag.type';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import { InventoriesService } from '../inventories/inventories.service';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private inventoriesService: InventoriesService,
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

  private getTotalAvaiableInventory = async (productId: number) => {
    const result = await this.prisma.inventory.aggregate({
      _sum: {
        avaiable: true,
      },
      where: {
        productVariant: {
          productId: productId,
        },
      },
    });

    return result._sum.avaiable;
  };

  private getProductOptions = async (productId: number) => {
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
          },
        },
      },
    });

    const categories = productCategories.map((pcat) => {
      return {
        id: pcat.category.id,
        title: pcat.category.title,
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

    const productSelect = {};

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
      const count = await this.getTotalAvaiableInventory(product.id);
      responseProducts.push({
        ...product,
        inventory_avaiable: count,
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

          // Tạo variant
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
                        InventoryProductTransactionAction.INITIAL_SETUP,
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
                          InventoryProductTransactionAction.INITIAL_SETUP,
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
    // Check if title is exist
    const isTitleExist = await this.prisma.category.findUnique({
      where: {
        title: dto.title,
      },
      select: {
        id: true,
      },
    });

    if (isTitleExist) throw new BadRequestException('Tiêu đề đã tồn tại');

    // Create new category
    const category = await this.prisma.category.create({
      data: {
        title: dto.title,
        slug: dto.slug,
      },
    });

    return res.status(200).json({ data: category });
  }

  async updateCategory(dto, req, res: Response) {
    return null;
  }

  async deleteCategory(dto, req, res: Response) {
    return null;
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
      },
      where: whereCondition,
      orderBy: {
        title: 'asc',
      },
      take: 10,
      skip: 0,
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
      await this.prisma.$transaction(async (p) => {
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
      });

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
}
