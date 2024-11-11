import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ProductModule } from './modules/product/product.module';
import { TagsController } from './modules/tags/tags.controller';
import { TagsModule } from './modules/tags/tags.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';

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
  ],
  controllers: [TagsController],
  providers: [],
})
export class AppModule {}
