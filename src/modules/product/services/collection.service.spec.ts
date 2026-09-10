import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCollectionDTO } from '../product';
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

  it('returns collection lists for the product query facade', async () => {
    const collections = [{ id: 1, title: 'Summer', slug: 'summer' }];
    const findMany = jest.fn().mockResolvedValue(collections);
    const prisma = {
      collection: { findMany },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    const result = await service.getCollections();

    expect(result).toBe(collections);
    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        title: true,
        slug: true,
        categories: {
          select: {
            id: true,
            image: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { position: 'asc' },
    });
  });

  it('creates a collection without an HTTP response dependency', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      collection: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _max: { id: null } }),
        create,
      },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    await expect(
      service.createCollection({
        title: ' Summer ',
        slug: ' summer ',
      } as CreateCollectionDTO)
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledWith({
      data: { title: 'Summer', slug: 'summer', position: 1 },
    });
  });
});
