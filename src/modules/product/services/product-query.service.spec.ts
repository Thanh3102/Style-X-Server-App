import { QueryParams } from 'src/utils/types/query.types';
import { Response } from 'express';
import { CategoryService } from './category.service';
import { CollectionService } from './collection.service';
import { ProductAdminQueryService } from './product-admin-query.service';
import { ProductPublicQueryService } from './product-public-query.service';
import { ProductQueryService } from './product-query.service';
import { ProductVariantQueryService } from './product-variant-query.service';

describe('ProductQueryService', () => {
  it('delegates product options to the variant query capability', async () => {
    const options = [{ id: 1, name: 'Color', values: ['Black'] }];
    const variantQuery = {
      getProductOptions: jest.fn().mockResolvedValue(options),
    } as unknown as ProductVariantQueryService;
    const service = new ProductQueryService(
      {} as ProductAdminQueryService,
      {} as ProductPublicQueryService,
      variantQuery,
      {} as CategoryService,
      {} as CollectionService
    );

    const result = await service.getProductOptions(10, true);

    expect(result).toBe(options);
    expect(variantQuery.getProductOptions).toHaveBeenCalledWith(10, true);
  });

  it('delegates category lookup without owning its persistence query', async () => {
    const categories = [{ id: 1, title: 'Shoes' }];
    const categoryService = {
      getCategories: jest.fn().mockResolvedValue(categories),
    } as unknown as CategoryService;
    const service = new ProductQueryService(
      {} as ProductAdminQueryService,
      {} as ProductPublicQueryService,
      {} as ProductVariantQueryService,
      categoryService,
      {} as CollectionService
    );

    const query: QueryParams = { query: 'shoe' };
    const result = await service.getCategories(query);

    expect(result).toBe(categories);
    expect(categoryService.getCategories).toHaveBeenCalledWith(query);
  });

  it('maps collection lists through the product query facade', async () => {
    const collections = [{ id: 1, title: 'Summer' }];
    const collectionService = {
      getCollections: jest.fn().mockResolvedValue(collections),
    } as unknown as CollectionService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new ProductQueryService(
      {} as ProductAdminQueryService,
      {} as ProductPublicQueryService,
      {} as ProductVariantQueryService,
      {} as CategoryService,
      collectionService
    );

    await service.getCollections(response);

    expect(collectionService.getCollections).toHaveBeenCalledWith();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(collections);
  });
});
