import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ActivityService } from './application/activity.service';
import { PgActivityRepository } from './infrastructure/pg-activity-repository';
import { ActivityController } from './presentation/activity.controller';

@Module({
  imports: [AuthModule],
  controllers: [ActivityController],
  providers: [ActivityService, PgActivityRepository],
})
export class ActivityModule {}
