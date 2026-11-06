import type { CircleSummary } from '@repo/api';
import { Badge } from '@repo/ui/components/badge';
import { buttonVariants } from '@repo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table';
import Link from 'next/link';

import { formatUsd } from '../../lib/money';

function statusLabel(status: CircleSummary['status']): string {
  if (status === 'forming') {
    return 'Forming';
  }

  if (status === 'active') {
    return 'Active';
  }

  return 'Completed';
}

export function CircleList({ circles }: { circles: CircleSummary[] }) {
  if (circles.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>No circle yet</CardTitle>
            <CardDescription>
              A circle starts when 6 people have joined. You set the monthly
              amount, and the payout order is fixed at the start. Nothing is due
              until then.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants()} href="/circles/new">
              Create a circle
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
        <div className="border-b px-4 py-4">
          <h2 className="font-medium">Your circles</h2>
          <p className="text-sm text-muted-foreground">
            Monthly amount and membership are saved. Paid and recipient stay
            blank until a circle starts and a payment is recorded.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Circle</TableHead>
              <TableHead>Monthly</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Recipient</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {circles.map((circle) => (
              <TableRow key={circle.id}>
                <TableCell className="font-medium">{circle.name}</TableCell>
                <TableCell className="tabular-nums">
                  {formatUsd(circle.monthlyAmountMinor)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {`${circle.memberCount} of ${circle.membersRequired}`}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{statusLabel(circle.status)}</Badge>
                </TableCell>
                <TableCell>
                  {circle.status === 'forming' ? 'Nothing due' : 'Not recorded'}
                </TableCell>
                <TableCell>Not set</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
