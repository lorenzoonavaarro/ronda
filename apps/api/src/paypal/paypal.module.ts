import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PaypalService } from './application/paypal.service';
import { PAYPAL_IDENTITY, PAYPAL_REPOSITORY } from './application/ports';
import { PaypalIdentityClient } from './infrastructure/paypal-identity-client';
import { PgPaypalRepository } from './infrastructure/pg-paypal-repository';
import { PaypalController } from './presentation/paypal.controller';

@Module({
  imports: [AuthModule],
  controllers: [PaypalController],
  providers: [
    PaypalService,
    PgPaypalRepository,
    PaypalIdentityClient,
    { provide: PAYPAL_REPOSITORY, useExisting: PgPaypalRepository },
    { provide: PAYPAL_IDENTITY, useExisting: PaypalIdentityClient },
  ],
})
export class PaypalModule {}
