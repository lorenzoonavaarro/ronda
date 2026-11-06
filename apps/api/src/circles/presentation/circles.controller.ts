import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CircleSummary } from '@repo/api';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { CirclesService } from '../application/circles.service';
import { InvalidCircleInputError } from '../domain/errors';

@Controller('circles')
@UseGuards(SessionGuard)
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<CircleSummary[]> {
    return this.circles.listForUser(request.user.id);
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<CircleSummary> {
    try {
      return await this.circles.create(request.user.id, body);
    } catch (error) {
      if (error instanceof InvalidCircleInputError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
