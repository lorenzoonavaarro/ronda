import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CreditService } from './application/credit.service';
import { CREDIT_RECORDER, CREDIT_REPOSITORY } from './application/ports';
import { PgCreditRepository } from './infrastructure/pg-credit-repository';
import { CreditController } from './presentation/credit.controller';

@Module({
  imports: [AuthModule],
  controllers: [CreditController],
  providers: [
    CreditService,
    PgCreditRepository,
    { provide: CREDIT_REPOSITORY, useExisting: PgCreditRepository },
    { provide: CREDIT_RECORDER, useExisting: CreditService },
  ],
  exports: [CREDIT_RECORDER, CreditService],
})
export class CreditModule {}
