import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCollectionDTO, UpdateCollectionDTO } from '../product';
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

  it('returns the collection limit validation message without creating a collection', async () => {
    const findUnique = jest.fn();
    const create = jest.fn();
    const prisma = {
      collection: {
        findMany: jest.fn().mockResolvedValue(new Array(5).fill({})),
        findUnique,
        create,
      },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    await expect(
      service.createCollection({} as CreateCollectionDTO)
    ).resolves.toBe('Số lượng bộ sưu tập đã đạt tối đa');

    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('updates collection data after uniqueness checks', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      collection: {
        findFirst: jest.fn().mockResolvedValue(null),
        update,
      },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    await service.updateCollection({
      id: '6',
      title: ' Summer ',
      slug: ' summer ',
    } as UpdateCollectionDTO);

    expect(update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { title: 'Summer', slug: 'summer' },
    });
  });

  it('returns collection update validation before writing', async () => {
    const update = jest.fn();
    const prisma = {
      collection: {
        findFirst: jest.fn().mockResolvedValue({ id: 7 }),
        update,
      },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    await expect(
      service.updateCollection({} as UpdateCollectionDTO)
    ).resolves.toBe('Tiêu đề đã tồn tại');

    expect(update).not.toHaveBeenCalled();
  });

  it('deletes a collection before decrementing later collection positions', async () => {
    const events: string[] = [];
    const transaction = jest.fn(async (callback) =>
      callback({
        collection: {
          delete: jest.fn(async () => {
            events.push('delete-collection');
            return { position: 2 };
          }),
        },
      })
    );
    const update = jest.fn(async () => events.push('decrement-4'));
    const prisma = {
      $transaction: transaction,
      collection: {
        findMany: jest.fn(async () => {
          events.push('find-collections');
          return [
            { id: 1, position: 1 },
            { id: 4, position: 4 },
          ];
        }),
        update,
      },
    } as unknown as PrismaService;
    const service = new CollectionService(prisma);

    await service.deleteCollection(2);

    expect(events).toEqual([
      'delete-collection',
      'find-collections',
      'decrement-4',
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { position: { decrement: 1 } },
    });
  });
});
