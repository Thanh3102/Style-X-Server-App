import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDTO } from '../product';
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
});
