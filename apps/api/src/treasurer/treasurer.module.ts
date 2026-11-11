import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CirclesModule } from '../circles/circles.module';
import { CreditModule } from '../credit/credit.module';
import { PaypalModule } from '../paypal/paypal.module';
import { TreasurerService } from './application/treasurer.service';
import { TREASURER_MODEL } from './application/ports';
import { AstroTreasurerModel } from './infrastructure/astro-treasurer-model';
import { TreasurerController } from './presentation/treasurer.controller';

@Module({
  imports: [AuthModule, CirclesModule, CreditModule, PaypalModule],
  controllers: [TreasurerController],
  providers: [
    TreasurerService,
    AstroTreasurerModel,
    { provide: TREASURER_MODEL, useExisting: AstroTreasurerModel },
  ],
})
export class TreasurerModule {}
