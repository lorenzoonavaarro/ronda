import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CirclesModule } from './circles/circles.module';
import { DatabaseModule } from './database/database.module';
import { PaypalModule } from './paypal/paypal.module';
import { TreasurerModule } from './treasurer/treasurer.module';

import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CirclesModule,
    PaypalModule,
    TreasurerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
