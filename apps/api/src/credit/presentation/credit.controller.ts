import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { CreditRecord } from '@repo/api';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { CreditService } from '../application/credit.service';

@Controller('credit')
@UseGuards(SessionGuard)
export class CreditController {
  constructor(private readonly credit: CreditService) {}

  @Get()
  read(@Req() request: AuthenticatedRequest): Promise<CreditRecord> {
    return this.credit.read(request.user.id);
  }
}
