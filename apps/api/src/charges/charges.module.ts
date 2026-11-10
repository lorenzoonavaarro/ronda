import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CreditModule } from '../credit/credit.module';
import { ChargesService } from './application/charges.service';
import {
  CHARGE_READER,
  CHARGE_REPOSITORY,
  PAYPAL_PAYMENTS,
} from './application/ports';
import { PaypalPaymentsClient } from './infrastructure/paypal-payments-client';
import { PgChargeRepository } from './infrastructure/pg-charge-repository';
import { ChargeScheduler } from './presentation/charge-scheduler';
import { ChargesController } from './presentation/charges.controller';

@Module({
  imports: [AuthModule, CreditModule],
  controllers: [ChargesController],
  providers: [
    ChargesService,
    ChargeScheduler,
    PgChargeRepository,
    PaypalPaymentsClient,
    { provide: CHARGE_REPOSITORY, useExisting: PgChargeRepository },
    { provide: PAYPAL_PAYMENTS, useExisting: PaypalPaymentsClient },
    { provide: CHARGE_READER, useExisting: ChargesService },
  ],
  exports: [CHARGE_READER],
})
export class ChargesModule {}
