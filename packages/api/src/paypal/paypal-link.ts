export type PaypalAccountDetails = {
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
  accountVerified: boolean;
  accountType: 'PERSONAL' | 'BUSINESS' | 'PREMIER' | null;
  payerId: string;
  linkedAt: string;
};

export type PaypalLinkStatus = {
  configured: boolean;
  environment: 'sandbox' | 'live' | null;
  returnUrl: string;
  account: PaypalAccountDetails | null;
};
