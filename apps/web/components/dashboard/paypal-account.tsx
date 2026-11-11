import type { PaypalAccountDetails } from '@repo/api';
import { Badge } from '@repo/ui/components/badge';

import { UnlinkPaypal } from './unlink-paypal';

export function PaypalAccount({ account }: { account: PaypalAccountDetails }) {
  const linked = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(account.linkedAt));

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-medium">
            {account.fullName ?? 'Name not shared'}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {account.email ?? 'Email not shared'}
          </p>
        </div>
        <Badge variant="secondary">Linked</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{accountTypeLabel(account.accountType)}</Badge>
        <Badge variant={account.emailVerified ? 'outline' : 'destructive'}>
          {account.emailVerified ? 'Email verified' : 'Email not verified'}
        </Badge>
        <Badge variant={account.accountVerified ? 'outline' : 'destructive'}>
          {account.accountVerified ? 'Account verified' : 'Account not verified'}
        </Badge>
      </div>
      <dl className="grid gap-3 border-t border-border/70 pt-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Payer ID</dt>
          <dd className="font-medium break-all">{account.payerId}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Linked</dt>
          <dd className="font-medium">{linked} UTC</dd>
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
