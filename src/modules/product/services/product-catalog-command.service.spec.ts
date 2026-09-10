import { Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  CreateCategoryDTO,
  CreateCollectionDTO,
  UpdateCategoryDTO,
  UpdateCollectionDTO,
} from '../product';
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

  it('maps a successful category update to the existing response', async () => {
    const categoryService = {
      updateCategory: jest.fn().mockResolvedValue(undefined),
    } as unknown as CategoryService;
    const response = createResponse();
    const service = new ProductCatalogCommandService(
      categoryService,
      {} as CollectionService
    );

    await service.updateCategory({} as UpdateCategoryDTO, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      message: 'Cập nhật danh mục thành công',
    });
  });

  it('maps a successful category deletion to the existing response', async () => {
    const categoryService = {
      deleteCategory: jest.fn().mockResolvedValue(undefined),
    } as unknown as CategoryService;
    const response = createResponse();
    const service = new ProductCatalogCommandService(
      categoryService,
      {} as CollectionService
    );

    await service.deleteCategory(5, response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ message: 'Đã xóa danh mục' });
  });

  it.each([
    ['createCollection', 'Thêm thành công', {} as CreateCollectionDTO],
    ['updateCollection', 'Cập nhật thành công', {} as UpdateCollectionDTO],
  ] as const)(
    'maps a successful %s command to its existing response',
    async (method, message, dto) => {
      const collectionService = {
        createCollection: jest.fn().mockResolvedValue(undefined),
        updateCollection: jest.fn().mockResolvedValue(undefined),
      } as unknown as CollectionService;
      const response = createResponse();
      const service = new ProductCatalogCommandService(
        {} as CategoryService,
        collectionService
      );

      if (method === 'createCollection')
        await service.createCollection(dto as CreateCollectionDTO, response);
      else await service.updateCollection(dto as UpdateCollectionDTO, response);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({ message });
    }
  );

  it('maps a successful collection deletion to the existing response', async () => {
    const collectionService = {
      deleteCollection: jest.fn().mockResolvedValue(undefined),
    } as unknown as CollectionService;
    const response = createResponse();
    const service = new ProductCatalogCommandService(
      {} as CategoryService,
      collectionService
    );

    await service.deleteCollection(8, response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      message: 'Đã xóa bộ sưu tập',
    });
  });

  it.each([
    ['updateCategory', 'Tiêu đề đã tồn tại'],
    ['createCollection', 'Số lượng bộ sưu tập đã đạt tối đa'],
    ['updateCollection', 'Đường dẫn đã tồn tại'],
  ] as const)(
    'maps %s validation to the existing bad-request response',
    async (method, message) => {
      const categoryService = {
        updateCategory: jest.fn().mockResolvedValue(message),
      } as unknown as CategoryService;
      const collectionService = {
        createCollection: jest.fn().mockResolvedValue(message),
        updateCollection: jest.fn().mockResolvedValue(message),
      } as unknown as CollectionService;
      const response = createResponse();
      const service = new ProductCatalogCommandService(
        categoryService,
        collectionService
      );

      if (method === 'updateCategory')
        await service.updateCategory({} as UpdateCategoryDTO, response);
      else if (method === 'createCollection')
        await service.createCollection({} as CreateCollectionDTO, response);
      else await service.updateCollection({} as UpdateCollectionDTO, response);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({ message });
    }
  );

  it('maps command failures to the existing server-error response and logs them', async () => {
    const error = new Error('database unavailable');
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();
    const categoryService = {
      deleteCategory: jest.fn().mockRejectedValue(error),
    } as unknown as CategoryService;
    const response = createResponse();
    const service = new ProductCatalogCommandService(
      categoryService,
      {} as CollectionService
    );

    await service.deleteCategory(5, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ message: 'Đã xảy ra lỗi' });
    expect(loggerError).toHaveBeenCalledWith(
      'database unavailable',
      error.stack
    );
    loggerError.mockRestore();
  });
});

function createResponse(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}
