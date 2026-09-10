import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
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
});
