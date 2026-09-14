import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { getErrorMessage, getErrorStack } from 'src/utils/helper/error.helper';
import {
  CreateCategoryDTO,
  CreateCollectionDTO,
  UpdateCategoryDTO,
  UpdateCollectionDTO,
} from '../product';
import { CategoryService } from './category.service';
import { CollectionService } from './collection.service';

@Injectable()
export class ProductCatalogCommandService {
  private readonly logger = new Logger(ProductCatalogCommandService.name);

  constructor(
    private readonly categoryService: CategoryService,
    private readonly collectionService: CollectionService
  ) {}

  createCategory(dto: CreateCategoryDTO, res: Response): Promise<Response> {
    return this.execute(
      () => this.categoryService.createCategory(dto),
      'Tạo danh mục thành công',
      res
    );
  }

  updateCategory(dto: UpdateCategoryDTO, res: Response): Promise<Response> {
    return this.execute(
      () => this.categoryService.updateCategory(dto),
      'Cập nhật danh mục thành công',
      res
    );
  }

  deleteCategory(id: number, res: Response): Promise<Response> {
    return this.execute(
      () => this.categoryService.deleteCategory(id),
      'Đã xóa danh mục',
      res,
      false
    );
  }

  createCollection(dto: CreateCollectionDTO, res: Response): Promise<Response> {
    return this.execute(
      () => this.collectionService.createCollection(dto),
      'Thêm thành công',
      res
    );
  }

  updateCollection(dto: UpdateCollectionDTO, res: Response): Promise<Response> {
    return this.execute(
      () => this.collectionService.updateCollection(dto),
      'Cập nhật thành công',
      res
    );
  }

  deleteCollection(id: number, res: Response): Promise<Response> {
    return this.execute(
      () => this.collectionService.deleteCollection(id),
      'Đã xóa bộ sưu tập',
      res,
      false
    );
  }

  private async execute(
    command: () => Promise<string | void>,
    successMessage: string,
    res: Response,
    setStatus = true
  ): Promise<Response> {
    try {
      const validationMessage = await command();
      if (validationMessage)
        return res.status(400).json({ message: validationMessage });
      if (!setStatus) return res.json({ message: successMessage });
      return res.status(200).json({ message: successMessage });
    } catch (error: unknown) {
      this.logger.error(getErrorMessage(error), getErrorStack(error));
      return res.status(500).json({ message: 'Đã xảy ra lỗi' });
    }
  }
}
