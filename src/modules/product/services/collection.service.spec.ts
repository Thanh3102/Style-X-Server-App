import { PrismaService } from 'src/prisma/prisma.service';
import { CollectionService } from './collection.service';

describe('CollectionService', () => {
  it('returns a collection detail for the product query facade', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 1, slug: 'summer' });
    const prisma = {
      collection: { findUnique },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    const result = await service.getCollectionDetail('summer');

    expect(result).toEqual({ id: 1, slug: 'summer' });
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: 'summer' },
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
  });
});
