import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ChargesModule } from '../charges/charges.module';
import { CreditModule } from '../credit/credit.module';
import { CirclesService } from './application/circles.service';
import { CIRCLE_REPOSITORY } from './application/ports';
import { PgCircleRepository } from './infrastructure/pg-circle-repository';
import { CirclesController } from './presentation/circles.controller';

@Module({
  imports: [AuthModule, ChargesModule, CreditModule],
  controllers: [CirclesController],
  providers: [
    CirclesService,
    PgCircleRepository,
    { provide: CIRCLE_REPOSITORY, useExisting: PgCircleRepository },
  ],
  exports: [CirclesService],
})
export class CirclesModule {}
