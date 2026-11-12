import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PaperService } from './application/paper.service';
import { PAPER_GRANTS } from './application/ports';
import { AlpacaMarketData } from './infrastructure/alpaca-market-data';
import { PgPaperRepository } from './infrastructure/pg-paper-repository';
import { PaperController } from './presentation/paper.controller';

@Module({
  imports: [AuthModule],
  controllers: [PaperController],
  providers: [
    PaperService,
    PgPaperRepository,
    AlpacaMarketData,
    { provide: PAPER_GRANTS, useExisting: PaperService },
  ],
  exports: [PAPER_GRANTS],
})
export class PaperModule {}
