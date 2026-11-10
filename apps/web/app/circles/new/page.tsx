import { CreateCircleForm } from '@/components/dashboard/create-circle-form';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { requireUser } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function NewCirclePage() {
  const user = await requireUser();

  return (
    <DashboardShell title="New circle" user={user}>
      <Card className="mx-4 max-w-xl lg:mx-6">
        <CardHeader>
          <CardTitle>Create a circle</CardTitle>
          <CardDescription>
            Set the name and the fixed monthly contribution. Amounts are in US
            dollars, from $1.00 to $100,000.00.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCircleForm />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
