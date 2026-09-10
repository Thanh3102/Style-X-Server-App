import { Injectable } from '@nestjs/common';
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
export class ProductMutationService {
  private readonly tagType = TagType.PRODUCT;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly productValidationService: ProductValidationService
  ) {}

  async create(dto: CreateProductDTO, requestUserId: number): Promise<number> {
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
            skuCode,
            avaiable: dto.avaiable,
            comparePrice: dto.comparePrice,
            costPrice: dto.costPrice,
            sellPrice: dto.sellPrice,
            description: dto.description,
            shortDescription: dto.shortDescription,
            unit: dto.unit ? dto.unit.trim() : undefined,
            vendor: dto.vendor ? dto.vendor.trim() : undefined,
            type: dto.type ? dto.type.trim() : undefined,
            createdUserId: requestUserId,
            updatedUserId: requestUserId,
          },
          select: {
            id: true,
          },
        });

        for (const property of dto.options) {
          await p.productProperties.create({
            data: {
              name: property.name,
              position: parseInt(property.position),
              productId: createdProduct.id,
              values: {
                createMany: {
                  data: property.values.map((value) => ({ value })),
                },
              },
            },
          });
        }

        if (dto.variants.length === 0) {
          const defaultVariant = await p.productVariants.create({
            data: {
              title: 'Default Title',
              barCode: dto.barCode,
              skuCode,
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
                    transactionAction: InventoryTransactionAction.INITIAL_SETUP,
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

        const allProductTags = await p.tag.findMany({
          select: {
            id: true,
            name: true,
          },
          where: {
            type: this.tagType,
          },
        });

        for (const dtoTag of dto.tags) {
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

        await p.productCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            categoryId,
            productId: createdProduct.id,
          })),
        });

        let isMainImage = true;
        for (const image of dto.images) {
          const uploadResult = await this.cloudinary.uploadFile(image, {
            folder: 'StyleX',
          });
          const { url } = await p.productImages.create({
            data: {
              assetId: uploadResult.asset_id,
              publicId: uploadResult.public_id,
              bytes: image.size,
              url: uploadResult.secure_url,
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
          isMainImage = false;
        }

        return createdProduct;
      },
      {
        timeout: 30000,
        maxWait: 10000,
      }
    );

    return createProductId;
  }

  async update(dto: UpdateProductDTO, updateUserId: number): Promise<void> {
    await this.prisma.$transaction(
      async (p) => {
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

        for (const categoryId of dto.addCategoryIds) {
          await p.productCategory.create({
            data: {
              categoryId,
              productId: dto.id,
            },
          });
        }

        await p.productCategory.deleteMany({
          where: {
            productId: dto.id,
            categoryId: {
              in: dto.deleteCategoryIds,
            },
          },
        });

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
          const findTag = allProductTags.find(
            (productTag) => productTag.name === tag
          );
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
            await p.tag.create({
              data: {
                name: tag,
                type: this.tagType,
              },
            });
          }
        }

        const deleteTags = allProductTags.filter((productTag) =>
          dto.deleteTags.includes(productTag.name)
        );

        await p.productTag.deleteMany({
          where: {
            productId: dto.id,
            tagId: {
              in: deleteTags.map((tag) => tag.id),
            },
          },
        });

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
          const currentValues = updateProduct.productProperties
            .find((property) => property.position === option.position)
            .values.map((value) => value.value);

          const addValues = option.values.filter(
            (value) => !currentValues.includes(value)
          );
          const deleteValues = currentValues.filter(
            (value) => !option.values.includes(value)
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
  }

  async delete(id: number): Promise<void> {
    await this.prisma.product.update({
      where: {
        id,
      },
      data: {
        void: true,
      },
    });
  }

  validateUpdateVariant(dto: UpdateVariantDTO): Promise<void> {
    return this.productValidationService.checkUpdateVariantConflict(dto);
  }

  async updateVariant(dto: UpdateVariantDTO): Promise<void> {
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
  }
}
