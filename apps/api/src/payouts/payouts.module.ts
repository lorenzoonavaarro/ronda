import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CirclesModule } from '../circles/circles.module';
import { PaperModule } from '../paper/paper.module';
import { PaypalModule } from '../paypal/paypal.module';
import { PayoutsService } from './application/payouts.service';
import { PAYPAL_PAYOUTS, PAYOUT_REPOSITORY } from './application/ports';
import { PayoutsController } from './presentation/payouts.controller';
import { PgPayoutRepository } from './infrastructure/pg-payout-repository';
import { PaypalPayoutsClient } from './infrastructure/paypal-payouts-client';

@Module({
  imports: [AuthModule, CirclesModule, PaypalModule, PaperModule],
  controllers: [PayoutsController],
  providers: [
    PayoutsService,
    PgPayoutRepository,
    PaypalPayoutsClient,
    { provide: PAYOUT_REPOSITORY, useExisting: PgPayoutRepository },
    { provide: PAYPAL_PAYOUTS, useExisting: PaypalPayoutsClient },
  ],
})
export class PayoutsModule {}
