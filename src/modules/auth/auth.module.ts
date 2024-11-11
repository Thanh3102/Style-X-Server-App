import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET_KEY,
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, EmployeesService],
  exports: [AuthService],
})
export class AuthModule {}
