import { CircleList } from '@/components/dashboard/circle-list';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

import { getAllCircles, requireUser } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function CirclesPage() {
  await requireUser();

  const circles = await getAllCircles();

  return (
    <DashboardShell title="Circles">
      <CircleList circles={circles} searchable />
    </DashboardShell>
  );
}
