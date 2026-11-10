import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { TreasurerReply } from '@repo/api';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { TreasurerService } from '../application/treasurer.service';
import {
  InvalidTreasurerInputError,
  TreasurerUnavailableError,
} from '../domain/errors';
import { parseTreasurerAsk } from '../domain/parse-treasurer-input';

@Controller('treasurer')
@UseGuards(SessionGuard)
export class TreasurerController {
  constructor(private readonly treasurer: TreasurerService) {}

  @Post()
  async ask(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<TreasurerReply> {
    try {
      const reply = await this.treasurer.ask(
        request.user.id,
        parseTreasurerAsk(body),
      );

      return { reply };
    } catch (error) {
      if (error instanceof InvalidTreasurerInputError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof TreasurerUnavailableError) {
        throw new ServiceUnavailableException(error.message);
      }

      throw error;
    }
  }
}
