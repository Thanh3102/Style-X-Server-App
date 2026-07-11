import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { OrderModule } from './modules/order/order.module';
import { ReportModule } from './modules/report/report.module';
import { CustomerModule } from './modules/customer/customer.module';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis, { Keyv } from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      useFactory: async () => {
        const redisUri = `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? 6379}`;
        Logger.debug(`Connecting to Redis at ${redisUri}`, 'AppModule');
        return {
          stores: [
            new KeyvRedis(redisUri),
            // new Keyv({
            //   store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
            // }),
          ],
        };
      },
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
    ReceiveInventoryModule,
    DiscountModule,
    MailModule,
    CartModule,
    OrderModule,
    ReportModule,
    CustomerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
