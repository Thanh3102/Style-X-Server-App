import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailModule } from '../mail/mail.module';
import { EmployeesModule } from '../employees/employees.module';
import { CustomerModule } from '../customer/customer.module';
import { CustomerAuthService } from './services/customer-auth.service';
import { EmployeeAuthService } from './services/employee-auth.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      global: true,
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET_KEY');
        if (!secret) {
          throw new Error(
            'JWT_SECRET_KEY is not defined in environment variables'
          );
        }
        return {
          secret,
        };
      },
      inject: [ConfigService],
    }),
    EmployeesModule,
    CustomerModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomerAuthService,
    EmployeeAuthService,
    TokenService,
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
