import { PaperActivity } from '@/components/dashboard/paper-activity';
import { PaperDesk } from '@/components/dashboard/paper-desk';
import { PaperHoldings } from '@/components/dashboard/paper-holdings';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

import { getPaperAccount, getPaperMarket, requireUser } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function StocksPage() {
  await requireUser();
  const [account, quotes] = await Promise.all([
    getPaperAccount(),
    getPaperMarket(),
  ]);

  return (
    <DashboardShell title="Stock">
      <div className="grid gap-4 px-4 lg:px-6">
        <PaperHoldings account={account} />
        <PaperDesk
          quotes={quotes}
          quotesConfigured={account.quotesConfigured}
          buysOpen={account.buysOpen}
        />
        <PaperActivity account={account} />
      </div>
    </DashboardShell>
  );
}
