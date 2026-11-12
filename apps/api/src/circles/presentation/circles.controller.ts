import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CircleDetail, CircleSummary } from '@repo/api';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { CirclesService } from '../application/circles.service';
import {
  CircleClosedError,
  CircleForbiddenError,
  CircleFullError,
  CircleLockedError,
  CircleNotFoundError,
  CircleNotReadyError,
  InvalidCircleInputError,
  InvalidInviteError,
} from '../domain/errors';

@Controller('circles')
@UseGuards(SessionGuard)
export class CirclesController {
  constructor(private readonly circles: CirclesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('scope') scope?: string,
  ): Promise<CircleSummary[]> {
    if (scope === 'all') {
      return this.circles.listAll(request.user.id);
    }

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

  @Post('join')
  @HttpCode(200)
  async join(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<CircleDetail> {
    try {
      return await this.circles.join(request.user.id, body);
    } catch (error) {
      throw this.circleError(error);
    }
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<CircleDetail> {
    try {
      return await this.circles.updateSettings(request.user.id, id, body);
    } catch (error) {
      if (error instanceof InvalidCircleInputError) {
        throw new BadRequestException(error.message);
      }

      throw this.circleError(error);
    }
  }

  @Post(':id/lock')
  @HttpCode(200)
  async lock(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<CircleDetail> {
    try {
      return await this.circles.lock(request.user.id, id);
    } catch (error) {
      throw this.circleError(error);
    }
  }

  @Get(':id')
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<CircleDetail> {
    try {
      return await this.circles.getForMember(request.user.id, id);
    } catch (error) {
      throw this.circleError(error);
    }
  }

  private circleError(error: unknown): Error {
    if (error instanceof InvalidInviteError) {
      return new BadRequestException(error.message);
    }

    if (error instanceof CircleNotFoundError) {
      return new NotFoundException(error.message);
    }

    if (error instanceof CircleForbiddenError) {
      return new ForbiddenException(error.message);
    }

    if (
      error instanceof CircleFullError ||
      error instanceof CircleClosedError ||
      error instanceof CircleNotReadyError ||
      error instanceof CircleLockedError
    ) {
      return new ConflictException(error.message);
    }

    return error instanceof Error ? error : new Error('Circle request failed.');
  }
}
