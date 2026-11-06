import { redirect } from 'next/navigation';

import { CircleList } from '@/components/dashboard/circle-list';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

import { getCircles, getCurrentUser } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function CirclesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const circles = await getCircles();

  return (
    <DashboardShell title="Circles" user={user}>
      <CircleList circles={circles} />
    </DashboardShell>
  );
}
