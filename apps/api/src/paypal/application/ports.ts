import type { PaypalAccountType } from '../domain/paypal-profile';

export type StoredPaypalAccount = {
  userId: string;
  payerId: string;
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
  accountVerified: boolean;
  accountType: PaypalAccountType | null;
  linkedAt: Date;
};

export interface PaypalRepository {
  findByUser(userId: string): Promise<StoredPaypalAccount | null>;
  save(account: StoredPaypalAccount): Promise<void>;
  delete(userId: string): Promise<void>;
}

export interface PaypalIdentity {
  exchangeCode(code: string): Promise<{
    payerId: string;
    fullName: string | null;
    email: string | null;
    emailVerified: boolean;
    accountVerified: boolean;
    accountType: PaypalAccountType | null;
  }>;
}

export const PAYPAL_REPOSITORY = Symbol('PAYPAL_REPOSITORY');
export const PAYPAL_IDENTITY = Symbol('PAYPAL_IDENTITY');
