import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { MailModule } from '../mail/mail.module';
import { CustomerCredentialService } from './services/customer-credential.service';
import { CustomerProfileService } from './services/customer-profile.service';
import { CustomerQueryService } from './services/customer-query.service';

@Module({
  imports: [MailModule],
  controllers: [CustomerController],
  providers: [
    CustomerService,
    CustomerCredentialService,
    CustomerProfileService,
    CustomerQueryService,
  ],
  exports: [CustomerService],
})
export class CustomerModule {}
