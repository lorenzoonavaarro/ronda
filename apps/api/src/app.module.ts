import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CirclesModule } from './circles/circles.module';
import { DatabaseModule } from './database/database.module';
import { LinksModule } from './links/links.module';

import { AppService } from './app.service';
import { AppController } from './app.controller';

@Module({
  imports: [DatabaseModule, AuthModule, CirclesModule, LinksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
