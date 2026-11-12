import { PaperPortfolio } from '@/components/dashboard/paper-portfolio';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

import { getPaperAccount, requireUser } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  await requireUser();
  const account = await getPaperAccount();

  return (
    <DashboardShell title="Portfolio">
      <div className="px-4 lg:px-6">
        <PaperPortfolio account={account} />
      </div>
    </DashboardShell>
  );
}
