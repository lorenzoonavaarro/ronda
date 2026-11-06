import {
  scrypt as scryptCallback,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

import type { PasswordHasher } from '../application/ports';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await this.derive(
      password,
      salt,
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
    );

    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    const [scheme, cost, blockSize, parallelization, salt, expected] =
      passwordHash.split('$');

    if (scheme !== 'scrypt' || !salt || !expected) {
      return false;
    }

    const expectedKey = Buffer.from(expected, 'base64url');
    const actualKey = await this.derive(
      password,
      Buffer.from(salt, 'base64url'),
      Number(cost),
      Number(blockSize),
      Number(parallelization),
    );

    if (actualKey.length !== expectedKey.length) {
      return false;
    }

    return timingSafeEqual(actualKey, expectedKey);
  }

  private async derive(
    password: string,
    salt: Buffer,
    cost: number,
    blockSize: number,
    parallelization: number,
  ): Promise<Buffer> {
    const key = await scrypt(password, salt, KEY_LENGTH, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 64 * 1024 * 1024,
    });

    return Buffer.isBuffer(key) ? key : Buffer.from(key);
  }
}
