import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateCustomID } from 'src/utils/helper/CustomIDGenerator';
import {
  InventoryTransactionAction,
  InventoryTransactionType,
} from 'src/utils/types';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { TagType } from '../../tags/tag.type';
import {
  CreateProductDTO,
  UpdateProductDTO,
  UpdateVariantDTO,
} from '../product';
import { ProductValidationService } from './product-validation.service';

@Injectable()
export class ProductCommandService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private productValidationService: ProductValidationService
  ) {}

  private tagType = TagType.PRODUCT;

  async create(dto: CreateProductDTO, req, res: Response) {
    const requestUserId = req.user.id;
    try {
      await this.productValidationService.checkCreateProductConflict(dto);

      const skuCode = dto.skuCode
        ? dto.skuCode.trim()
        : await generateCustomID('SKU', 'product', 'skuCode');

      const { id: createProductId } = await this.prisma.$transaction(
        async (p) => {
          const createdProduct = await p.product.create({
            data: {
              name: dto.name.trim(),
              barCode: dto.barCode ? dto.barCode.trim() : undefined,
              skuCode: skuCode,
              avaiable: dto.avaiable,
              comparePrice: dto.comparePrice,
              costPrice: dto.costPrice,
              sellPrice: dto.sellPrice,
              description: dto.description,
              shortDescription: dto.shortDescription,
              unit: dto.unit ? dto.unit.trim() : undefined,
              vendor: dto.vendor ? dto.vendor.trim() : undefined,
              type: dto.type ? dto.type.trim() : undefined,
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
        }
      );

      return res.status(200).json({ id: createProductId });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: error.message ?? 'Đã xảy ra lỗi' });
    }
  }

  async update(dto: UpdateProductDTO, req, res: Response) {
    const updateUserId = req.user.id;
    try {
      await this.prisma.$transaction(
        async (p) => {
          // Update product
          const updateProduct = await p.product.update({
            where: {
              id: dto.id,
            },
            data: {
              name: dto.name.trim(),
              description: dto.description,
              shortDescription: dto.shortDescription,
              avaiable: dto.avaiable,
              type: dto.type ? dto.type.trim() : undefined,
              vendor: dto.vendor ? dto.vendor.trim() : undefined,
              updatedUserId: updateUserId,
              sellPrice: dto.sellPrice,
              comparePrice: dto.comparePrice,
              costPrice: dto.comparePrice,
            },
            select: {
              id: true,
              productProperties: {
                select: {
                  id: true,
                  name: true,
                  position: true,
                  values: true,
                },
              },
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
            dto.deleteTags.includes(pTag.name)
          );

          await p.productTag.deleteMany({
            where: {
              productId: dto.id,
              tagId: {
                in: deleteTags.map((tag) => tag.id),
              },
            },
          });

          console.log('new variant ', dto.newVariants);

          // Tạo variant mới
          if (dto.newVariants.length > 0) {
            await p.productVariants.createMany({
              data: dto.newVariants.map((item) => ({
                productId: updateProduct.id,
                title: item.title,
                barCode: item.barCode ?? null,
                comparePrice: item.comparePrice,
                costPrice: item.costPrice,
                option1: item.option1 ?? null,
                option2: item.option2 ?? null,
                option3: item.option3 ?? null,
                sellPrice: item.sellPrice,
                skuCode: item.skuCode ?? null,
                unit: item.unit ?? null,
              })),
            });
          }

          // Cập nhật lại options
          for (const option of dto.options) {
            await p.productProperties.update({
              where: {
                id: option.id,
              },
              data: {
                name: option.name,
                position: option.position,
              },
            });
            const values = option.values;
            const currentValues = updateProduct.productProperties
              .find((prop) => prop.position === option.position)
              .values.map((v) => v.value);

            const addValues = values.filter((v) => !currentValues.includes(v));
            const deleteValues = currentValues.filter(
              (v) => !values.includes(v)
            );

            if (addValues.length > 0) {
              for (const addValue of addValues) {
                await p.productPropertyValues.create({
                  data: {
                    value: addValue,
                    productPropertyId: option.id,
                  },
                });
              }
            }
            if (deleteValues.length > 0) {
              await p.productPropertyValues.deleteMany({
                where: {
                  value: {
                    in: deleteValues,
                  },
                },
              });
            }
          }

          // Cập nhật lại variant đã xóa
          if (dto.deleteVariantIds.length > 0) {
            await p.productVariants.updateMany({
              where: {
                id: {
                  in: dto.deleteVariantIds,
                },
              },
              data: {
                void: true,
              },
            });
          }
        },
        { timeout: 10000 }
      );
      return res.status(200).json({ message: 'Cập nhật thông tin thành công' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        error.message ?? 'Đã xảy ra lỗi khi cập nhật thông tin sản phẩm'
      );
    }
  }

  async delete(id: number, res: Response) {
    try {
      await this.prisma.product.update({
        where: {
          id: id,
        },
        data: {
          void: true,
        },
      });
      return res.status(200).json({ message: 'Đã xóa sản phẩm' });
    } catch (error) {
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }

  async updateVariant(dto: UpdateVariantDTO, res: Response) {
    await this.productValidationService.checkUpdateVariantConflict(dto);
    try {
      await this.prisma.$transaction(
        async (p) => {
          await p.productVariants.update({
            where: {
              id: dto.variantId,
            },
            data: {
              barCode: dto.barCode ? dto.barCode.trim() : undefined,
              skuCode: dto.skuCode.trim(),
              sellPrice: dto.sellPrice,
              comparePrice: dto.comparePrice,
              costPrice: dto.costPrice,
              unit: dto.unit ? dto.unit.trim() : undefined,
            },
          });
        },
        {
          timeout: 10000,
        }
      );

      return res.status(200).json({ message: 'Đã cập nhật thông tin' });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        error.message ?? 'Đã xảy ra lỗi khi cập nhật phiên bản'
      );
    }
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
    res: Response
  ) {
    const uploadedPublicId = [];
    try {
      await this.prisma.$transaction(
        async (p) => {
          for (const img of images) {
            const result = await this.cloudinary.uploadFile(img);
            uploadedPublicId.push(result.public_id);
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
        { maxWait: 60000, timeout: 60000 }
      );

      return res.status(200).json({ message: 'Thêm ảnh thành công' });
    } catch (error) {
      for (const publicId of uploadedPublicId) {
        this.cloudinary.deleteFile(publicId);
      }
      console.log(error);
      throw new InternalServerErrorException(
        error.message ?? 'Đã xảy ra lỗi khi thêm ảnh'
      );
    }
  }
}
