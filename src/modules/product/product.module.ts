import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { DiscountModule } from '../discount/discount.module';
import { ProductQueryService } from './services/product-query.service';
import { ProductCommandService } from './services/product-command.service';
import { ProductInventoryService } from './services/product-inventory.service';
import { ProductValidationService } from './services/product-validation.service';
import { CategoryService } from './services/category.service';
import { CollectionService } from './services/collection.service';
import { ProductAdminQueryService } from './services/product-admin-query.service';
import { ProductCacheService } from './services/product-cache.service';
import { ProductMediaService } from './services/product-media.service';
import { ProductMutationService } from './services/product-mutation.service';
import { ProductPublicQueryService } from './services/product-public-query.service';
import { ProductVariantQueryService } from './services/product-variant-query.service';
import { ProductCatalogCommandService } from './services/product-catalog-command.service';

@Module({
  imports: [CloudinaryModule, InventoriesModule, DiscountModule],
  controllers: [ProductController],
  providers: [
    ProductQueryService,
    ProductCommandService,
    ProductInventoryService,
    ProductValidationService,
    CategoryService,
    CollectionService,
    ProductAdminQueryService,
    ProductCacheService,
    ProductMediaService,
    ProductMutationService,
    ProductPublicQueryService,
    ProductVariantQueryService,
    ProductCatalogCommandService,
  ],
  exports: [
    ProductQueryService,
    ProductInventoryService,
  ],
})
export class ProductModule {}
