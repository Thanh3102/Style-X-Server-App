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
import { ReceiveInventoryModule } from './modules/receive-inventory/receive-inventory.module';
import { DiscountModule } from './modules/discount/discount.module';
import { MailModule } from './modules/mail/mail.module';
import { CartModule } from './modules/cart/cart.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmployeesModule,
    ProductModule,
    TagsModule,
    SuppliersModule,
    WarehousesModule,
    CloudinaryModule,
    InventoriesModule,
    ReceiveInventoryModule,
    DiscountModule,
    MailModule,
    CartModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
