import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Overview } from '@/components/dashboard/overview';

import { getActivity, getCircles } from '../lib/api';

export async function SignedInHome() {
  const [circles, activity] = await Promise.all([getCircles(), getActivity()]);

  return (
    <DashboardShell title="Overview">
      <Overview circles={circles} activity={activity} />
    </DashboardShell>
  );
}
