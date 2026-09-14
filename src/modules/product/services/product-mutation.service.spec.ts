import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductValidationService } from './product-validation.service';
import { ProductMutationService } from './product-mutation.service';

describe('ProductMutationService', () => {
  it('updates variants through the transaction client', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const transactionClient = {
      productVariants: { update },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => Promise<void>) =>
          callback(transactionClient)
      ),
    } as unknown as PrismaService;
    const validation = {
      checkUpdateVariantConflict: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProductValidationService;
    const service = new ProductMutationService(
      prisma,
      {} as CloudinaryService,
      validation
    );

    await service.updateVariant({
      variantId: 10,
      barCode: ' 123 ',
      comparePrice: 100,
      costPrice: 50,
      sellPrice: 90,
      skuCode: ' SKU-1 ',
      unit: ' pair ',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        barCode: '123',
        skuCode: 'SKU-1',
        sellPrice: 90,
        comparePrice: 100,
        costPrice: 50,
        unit: 'pair',
      },
    });
  });
});
