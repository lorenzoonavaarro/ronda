import { Injectable } from '@nestjs/common';
import { createClient, type Session, type User } from '@supabase/supabase-js';

@Injectable()
export class SupabaseTokenService {
  private readonly client = this.createClient();

  async userForToken(token: string): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser(token);

    return error ? null : data.user;
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<Session | null> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    return error ? null : data.session;
  }

  private createClient() {
    const url = process.env.SUPABASE_URL?.trim();
    const key = firstSet(
      process.env.SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
    );

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for API authentication.',
      );
    }

    return createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
}

function firstSet(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}
