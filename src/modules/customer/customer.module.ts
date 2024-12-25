import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService, PrismaService, MailService, JwtService],
  exports: [CustomerService],
})
export class CustomerModule {}
