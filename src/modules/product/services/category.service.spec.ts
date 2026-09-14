import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDTO, UpdateCategoryDTO } from '../product';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  it('queries categories for the product query facade', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      category: { findMany },
    } as unknown as PrismaService;
    const service = new CategoryService(prisma, {} as CloudinaryService);

    await service.getCategories({ query: 'shoe' });

    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        title: true,
        slug: true,
        image: true,
        collection: true,
      },
      where: { title: { startsWith: 'shoe' } },
      orderBy: { title: 'asc' },
    });
  });

  it('creates a category without an HTTP response dependency', async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const transaction = jest.fn(async (callback) =>
      callback({ category: { create, update: jest.fn() } })
    );
    const prisma = {
      category: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new CategoryService(prisma, {} as CloudinaryService);

    await expect(
      service.createCategory({
        title: ' Shoes ',
        slug: ' shoes ',
        collectionId: '3',
      } as CreateCategoryDTO)
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledWith({
      data: { title: 'Shoes', slug: 'shoes', collectionId: 3 },
    });
  });

  it('returns the category title validation message without starting an update transaction', async () => {
    const transaction = jest.fn();
    const prisma = {
      category: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new CategoryService(prisma, {} as CloudinaryService);

    await expect(
      service.updateCategory({
        id: '3',
        title: 'Shoes',
        slug: 'shoes',
        collectionId: '1',
      } as UpdateCategoryDTO)
    ).resolves.toBe('Tiêu đề đã tồn tại');

    expect(transaction).not.toHaveBeenCalled();
  });

  it('updates category data and image in the existing transaction order', async () => {
    const events: string[] = [];
    const update = jest
      .fn()
      .mockImplementationOnce(async () => {
        events.push('update-category');
        return { id: 3, imagePublicId: 'old-image' };
      })
      .mockImplementationOnce(async () => {
        events.push('update-image');
      });
    const transaction = jest.fn(async (callback) =>
      callback({ category: { update } })
    );
    const cloudinary = {
      deleteFile: jest.fn(async () => events.push('delete-old-image')),
      uploadFile: jest.fn(async () => {
        events.push('upload-new-image');
        return { secure_url: 'https://cdn/new.jpg', public_id: 'new-image' };
      }),
    } as unknown as CloudinaryService;
    const prisma = {
      category: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new CategoryService(prisma, cloudinary);
    const image = {} as Express.Multer.File;

    await service.updateCategory({
      id: '3',
      title: ' Shoes ',
      slug: ' shoes ',
      collectionId: '1',
      image,
    } as UpdateCategoryDTO);

    expect(events).toEqual([
      'update-category',
      'delete-old-image',
      'upload-new-image',
      'update-image',
    ]);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10000,
      timeout: 10000,
    });
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 3 },
      data: { title: 'Shoes', slug: 'shoes' },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 3 },
      data: {
        image: 'https://cdn/new.jpg',
        imagePublicId: 'new-image',
      },
    });
  });

  it('deletes category links, the category, and its image in transaction order', async () => {
    const events: string[] = [];
    const transaction = jest.fn(async (callback) =>
      callback({
        productCategory: {
          deleteMany: jest.fn(async () => events.push('delete-links')),
        },
        category: {
          delete: jest.fn(async () => {
            events.push('delete-category');
            return { imagePublicId: 'category-image' };
          }),
        },
      })
    );
    const cloudinary = {
      deleteFile: jest.fn(async () => events.push('delete-image')),
    } as unknown as CloudinaryService;
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const service = new CategoryService(prisma, cloudinary);

    await service.deleteCategory(9);

    expect(events).toEqual(['delete-links', 'delete-category', 'delete-image']);
  });
});
