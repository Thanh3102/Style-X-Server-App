import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ProductModule } from './modules/product/product.module';
import { TagsModule } from './modules/tags/tags.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { InventoriesModule } from './modules/inventories/inventories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    EmployeesModule,
    ProductModule,
    TagsModule,
    SuppliersModule,
    WarehousesModule,
    CloudinaryModule,
    InventoriesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
