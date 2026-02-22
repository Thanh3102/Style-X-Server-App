import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { InventoriesModule } from '../inventories/inventories.module';
import { DiscountModule } from '../discount/discount.module';
import { ProductQueryService } from './services/product-query.service';
import { ProductCommandService } from './services/product-command.service';
import { ProductInventoryService } from './services/product-inventory.service';
import { ProductValidationService } from './services/product-validation.service';
import { CategoryService } from './services/category.service';
import { CollectionService } from './services/collection.service';

@Module({
  imports: [CloudinaryModule, InventoriesModule, DiscountModule],
  controllers: [ProductController],
  providers: [
    PrismaService,
    ProductQueryService,
    ProductCommandService,
    ProductInventoryService,
    ProductValidationService,
    CategoryService,
    CollectionService,
  ],
  exports: [
    ProductQueryService,
    ProductCommandService,
    ProductInventoryService,
    ProductValidationService,
    CategoryService,
    CollectionService,
  ],
})
export class ProductModule {}
