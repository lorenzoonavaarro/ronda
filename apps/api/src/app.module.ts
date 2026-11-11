import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CirclesModule } from './circles/circles.module';
import { DatabaseModule } from './database/database.module';
import { PaypalModule } from './paypal/paypal.module';
import { TreasurerModule } from './treasurer/treasurer.module';
import { PayoutsModule } from './payouts/payouts.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CirclesModule,
    PaypalModule,
    TreasurerModule,
    PayoutsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
