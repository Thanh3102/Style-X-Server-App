import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';
import { Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { tranformCreatedOnParams } from 'src/utils/helper/DateHelper';
import { isInteger } from 'src/utils/helper/StringHelper';
import { QueryParams } from 'src/utils/types';
import { DiscountService } from '../../discount/discount.service';
import { InventoriesService } from '../../inventories/inventories.service';
import { PublicProductParams } from '../product';
import { ProductInventoryService } from './product-inventory.service';
import { ProductValidationService } from './product-validation.service';

@Injectable()
export class ProductQueryService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private prisma: PrismaService,
    private inventoriesService: InventoriesService,
    private discountService: DiscountService,
    private productInventoryService: ProductInventoryService,
    private productValidationService: ProductValidationService
  ) {}

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
          id: pp.id,
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
        0
      );
      const discountInfo = await this.discountService.calcVariantDiscount(
        variant,
        activeProductPromotions
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
    } = queryParams;

    const page = !isNaN(Number(pg)) ? Number(pg) : 1;
    const limit = !isNaN(Number(lim)) ? Number(lim) : 20;
    const skip = page === 1 ? 0 : (page - 1) * limit;

    let whereCondition: Prisma.ProductWhereInput = {
      void: false,
    };

    if (query) {
      whereCondition.OR = [
        {
          name: {
            contains: query.trim(),
          },
        },
        {
          skuCode: {
            contains: query.trim(),
          },
        },
        {
          barCode: {
            contains: query.trim(),
          },
        },
        {
          variants: {
            some: {
              OR: [
                {
                  skuCode: query.trim(),
                },
                {
                  barCode: query.trim(),
                },
              ],
            },
          },
        },
      ];
    }

    if (createdOn || createdOnMin || createdOnMax) {
      const { startDate, endDate } = tranformCreatedOnParams(
        createdOn,
        createdOnMin,
        createdOnMax
      );
      if (startDate || endDate) {
        whereCondition.createdAt = {};
        if (startDate) whereCondition.createdAt.gte = startDate;
        if (endDate) whereCondition.createdAt.lte = endDate;
      }
    }

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
      const stock = await this.productInventoryService.getInventoryStock(
        product.id
      );
      const variantsWithStock = [];
      for (const variant of product.variants) {
        const variantStock =
          await this.productInventoryService.getVariantInventoryStock(
            variant.id
          );
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
      const stock = await this.productInventoryService.getVariantInventoryStock(
        variant.id
      );
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
      await this.productValidationService.checkValidProductId(id);
      const product = await this.prisma.product.findUnique({
        where: {
          id: id,
        },
        select: {
          void: true,
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
          vendor: true,
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
      throw new Error(error);
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
    });

    return categories;
  }

  async getProductPublic(
    where: Prisma.ProductWhereInput,
    order: Prisma.ProductOrderByWithRelationInput,
    skip: number,
    take: number
  ) {
    try {
      const basicProducts = await this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          image: true,
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

  private tranformPublicProductParamsToQuery = async (
    params: PublicProductParams
  ) => {
    const { query, category, slug, sort, priceRange } = params;
    let where: Prisma.ProductWhereInput = {
      avaiable: true,
      void: false,
    };
    let orderBy: Prisma.ProductOrderByWithRelationInput = {
      createdAt: 'desc',
    };

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

    return { where, orderBy };
  };

  async fetchProductPublic(params: PublicProductParams, res: Response) {
    try {
      const { page: pg, limit: lim, priceRange } = params;

      let page = 1;
      let limit = 20;

      if (isInteger(pg)) page = parseInt(pg);
      if (isInteger(lim)) limit = parseInt(lim);

      console.log(`Find value of key "products-page-${page}-${limit}"`);

      const cacheData: string = await this.cacheManager.get(
        `products-page-${page}-${limit}`
      );

      if (cacheData) {
        console.log('Cache:', cacheData);
        console.log(`Get value from key "products-page-${page}-${limit}"`);
        return res.status(200).json(JSON.parse(cacheData));
      }

      console.log('No cache value');

      const skip = page === 1 ? 0 : (page - 1) * limit;

      const { where, orderBy } =
        await this.tranformPublicProductParamsToQuery(params);

      const basicProducts = await this.getProductPublic(
        where,
        orderBy,
        skip,
        limit
      );

      const products = [];

      for (const product of basicProducts) {
        const { productCategories, ...rest } = product;

        const categoryIds = productCategories.map((item) => item.categoryId);
        const options = await this.getProductOptions(product.id);
        const variants = await this.getProductPublicVariants(product.id);

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

      const responseData = {
        data: products,
        total: count,
        limit: limit,
        currentPage: page,
        lastPage: count % limit == 0 ? totalPage : totalPage + 1,
      };

      console.log(`Create key "products-page-${page}-${limit}"`);

      await this.cacheManager.set(
        `products-page-${page}-${limit}`,
        JSON.stringify(responseData),
        60 * 60 * 1000
      );

      return res.status(200).json(responseData);
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
      await this.productValidationService.checkValidProductId(id);

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
        24
      );

      const sameCategoryProduct = [];

      for (const product of sameCategoryBasicProduct) {
        const { productCategories, ...rest } = product;
        const categoryIds = productCategories.map((item) => item.categoryId);
        const options = await this.getProductOptions(product.id);
        const variants = await this.getProductPublicVariants(product.id);

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
        undefined
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
