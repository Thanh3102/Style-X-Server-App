import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductMediaService } from './product-media.service';

describe('ProductMediaService', () => {
  it('updates a product main image without an Express response', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      product: { update },
    } as unknown as PrismaService;
    const service = new ProductMediaService(prisma, {} as CloudinaryService);

    await service.updateMainImage(10, 'https://cdn/image.jpg');

    expect(update).toHaveBeenCalledWith({
      data: { image: 'https://cdn/image.jpg' },
      where: { id: 10 },
    });
  });
});
