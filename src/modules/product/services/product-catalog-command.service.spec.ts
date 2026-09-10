import { Response } from 'express';
import { CreateCategoryDTO } from '../product';
import { CategoryService } from './category.service';
import { CollectionService } from './collection.service';
import { ProductCatalogCommandService } from './product-catalog-command.service';

describe('ProductCatalogCommandService', () => {
  it('maps a successful category command to the existing response', async () => {
    const categoryService = {
      createCategory: jest.fn().mockResolvedValue(undefined),
    } as unknown as CategoryService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new ProductCatalogCommandService(
      categoryService,
      {} as CollectionService
    );
    const dto = {
      title: 'Shoes',
      slug: 'shoes',
      collectionId: '3',
    } as CreateCategoryDTO;

    await service.createCategory(dto, response);

    expect(categoryService.createCategory).toHaveBeenCalledWith(dto);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Tạo danh mục thành công',
    });
  });

  it('maps catalog validation messages to the existing bad-request response', async () => {
    const categoryService = {
      createCategory: jest.fn().mockResolvedValue('Tiêu đề đã tồn tại'),
    } as unknown as CategoryService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new ProductCatalogCommandService(
      categoryService,
      {} as CollectionService
    );

    await service.createCategory({} as CreateCategoryDTO, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Tiêu đề đã tồn tại',
    });
  });
});
