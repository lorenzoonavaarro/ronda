import { Module } from '@nestjs/common';

import { AuthService } from './application/auth.service';
import {
  PASSWORD_HASHER,
  SESSION_REPOSITORY,
  USER_REPOSITORY,
} from './application/ports';
import { PgSessionRepository } from './infrastructure/pg-session-repository';
import { PgUserRepository } from './infrastructure/pg-user-repository';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher';
import { SupabaseTokenService } from './infrastructure/supabase-token.service';
import { AuthController } from './presentation/auth.controller';
import { SessionGuard } from './presentation/session.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionGuard,
    ScryptPasswordHasher,
    PgUserRepository,
    PgSessionRepository,
    SupabaseTokenService,
    { provide: USER_REPOSITORY, useExisting: PgUserRepository },
    { provide: SESSION_REPOSITORY, useExisting: PgSessionRepository },
    { provide: PASSWORD_HASHER, useExisting: ScryptPasswordHasher },
  ],
  exports: [AuthService, SessionGuard, SupabaseTokenService],
})
export class AuthModule {}
