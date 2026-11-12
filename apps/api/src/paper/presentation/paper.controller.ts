import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  PaperAccount,
  PaperFill,
  PaperMarketQuote,
  PaperQuote,
} from '@repo/api';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { PaperService } from '../application/paper.service';
import { PaperOrderError } from '../domain/errors';

@Controller('paper')
@UseGuards(SessionGuard)
export class PaperController {
  constructor(private readonly paper: PaperService) {}

  @Get()
  read(@Req() request: AuthenticatedRequest): Promise<PaperAccount> {
    return this.paper.read(request.user.id);
  }

  @Get('market')
  market(): Promise<PaperMarketQuote[]> {
    return this.paper.marketBoard();
  }

  @Get('quotes/:symbol')
  quote(@Param('symbol') symbol: string): Promise<PaperQuote> {
    return this.guard(() => this.paper.quote(symbol));
  }

  @Post('orders')
  order(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<PaperFill> {
    return this.guard(() => this.paper.order(request.user.id, body));
  }

  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof PaperOrderError) {
        throw new HttpException(error.message, error.statusCode);
      }

      throw error;
    }
  }
}
