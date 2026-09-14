import { Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { ProductCacheService } from './product-cache.service';
import { ProductCommandService } from './product-command.service';
import { ProductMediaService } from './product-media.service';
import { ProductMutationService } from './product-mutation.service';

describe('ProductCommandService', () => {
  it('delegates media mutation and invalidates public product pages', async () => {
    const mediaService = {
      updateMainImage: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProductMediaService;
    const cacheService = {
      invalidatePublicProductPages: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProductCacheService;
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const service = new ProductCommandService(
      {} as ProductMutationService,
      mediaService,
      cacheService
    );

    await service.updateMainImage(10, 'https://cdn/image.jpg', response);

    expect(mediaService.updateMainImage).toHaveBeenCalledWith(
      10,
      'https://cdn/image.jpg'
    );
    expect(cacheService.invalidatePublicProductPages).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      message: 'Cập nhật ảnh đại diện thành công',
    });
  });

  it('preserves validation errors from variant updates', async () => {
    const validationError = new BadRequestException('duplicate sku');
    const mutationService = {
      validateUpdateVariant: jest.fn().mockRejectedValue(validationError),
    } as unknown as ProductMutationService;
    const service = new ProductCommandService(
      mutationService,
      {} as ProductMediaService,
      {} as ProductCacheService
    );

    await expect(
      service.updateVariant(
        {
          variantId: 10,
          barCode: undefined,
          comparePrice: undefined,
          costPrice: undefined,
          sellPrice: undefined,
          skuCode: 'SKU-1',
          unit: undefined,
        },
        {} as Response
      )
    ).rejects.toBe(validationError);
  });
});
