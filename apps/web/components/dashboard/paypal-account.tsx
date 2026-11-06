import type { PaypalAccountDetails } from '@repo/api';
import { Badge } from '@repo/ui/components/badge';

import { UnlinkPaypal } from './unlink-paypal';

export function PaypalAccount({ account }: { account: PaypalAccountDetails }) {
  const linked = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(account.linkedAt));

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-base font-medium">
          {account.fullName ?? 'Name not shared'}
        </p>
        <p className="text-sm text-muted-foreground">
          {account.email ?? 'Email not shared'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{accountTypeLabel(account.accountType)}</Badge>
        <Badge variant="outline">
          {account.emailVerified ? 'Email verified' : 'Email not verified'}
        </Badge>
        <Badge variant="outline">
          {account.accountVerified
            ? 'Account verified'
            : 'Account not verified'}
        </Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Payer ID</dt>
          <dd className="font-medium break-all">{account.payerId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Linked</dt>
          <dd className="font-medium">{linked}</dd>
        </div>
      </dl>
      <UnlinkPaypal />
    </div>
  );
}

function accountTypeLabel(value: PaypalAccountDetails['accountType']): string {
  if (value === 'PERSONAL') {
    return 'Personal';
  }

  if (value === 'BUSINESS') {
    return 'Business';
  }

  if (value === 'PREMIER') {
    return 'Premier';
  }

  return 'Type not shared';
}
