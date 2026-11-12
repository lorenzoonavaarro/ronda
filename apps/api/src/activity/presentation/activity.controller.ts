import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ActivityRecord, CircleRounds } from '@repo/api';

import {
  SessionGuard,
  type AuthenticatedRequest,
} from '../../auth/presentation/session.guard';
import { ActivityService } from '../application/activity.service';

@Controller()
@UseGuards(SessionGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('activity')
  read(@Req() request: AuthenticatedRequest): Promise<ActivityRecord> {
    return this.activity.read(request.user.id);
  }

  @Get('circles/:id/rounds')
  async rounds(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<CircleRounds> {
    const rounds = await this.activity.rounds(request.user.id, id);

    if (!rounds) {
      throw new NotFoundException('Circle not found.');
    }

    return rounds;
  }
}
