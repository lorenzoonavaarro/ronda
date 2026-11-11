import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Overview } from '@/components/dashboard/overview';

import { getCircles } from '../lib/api';

export async function SignedInHome() {
  const circles = await getCircles();

  return (
    <DashboardShell title="Overview">
      <Overview circles={circles} />
    </DashboardShell>
  );
}
