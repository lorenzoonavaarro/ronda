import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RawBodyRequest } from '@nestjs/common';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { PayoutsService } from '../application/payouts.service';
import {
  PayoutNotReadyError,
  PayoutUnavailableError,
} from '../domain/errors';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Post(':circleId/confirm')
  @UseGuards(SessionGuard)
  async confirm(
    @Req() request: AuthenticatedRequest,
    @Param('circleId') circleId: string,
  ) {
    try {
      return await this.payouts.confirm(request.user.id, circleId);
    } catch (error) {
      if (error instanceof PayoutNotReadyError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof PayoutUnavailableError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }

  @Post('webhook')
  async webhook(@Req() request: RawBodyRequest<Request>): Promise<void> {
    const raw = request.rawBody;
    if (!raw || !(await this.payouts.webhook(raw, request.headers))) {
      throw new BadRequestException('Invalid PayPal payout webhook.');
    }
  }
}
