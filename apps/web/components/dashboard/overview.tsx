import type { CircleSummary } from '@repo/api';
import { Badge } from '@repo/ui/components/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { CircleList } from './circle-list';

export function Overview({ circles }: { circles: CircleSummary[] }) {
  const running = circles.some((circle) => circle.status !== 'forming');
  const due = running ? 'Not recorded yet' : 'Nothing due';
  const paid = running ? 'Not recorded' : 'Nothing due';

  return (
    <>
      <section className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Circles</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {circles.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {circles.length === 0 ? 'None yet' : 'Yours'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">Groups you belong to</div>
            <div className="text-muted-foreground">
              The creator locks a circle when its seats are filled.
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Due this month</CardDescription>
            <CardTitle className="text-2xl font-semibold leading-tight">
              {due}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">{running ? 'Open' : 'No pot'}</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">
              {running
                ? 'Waiting on a recorded payment'
                : 'No contribution is due'}
            </div>
            <div className="text-muted-foreground">
              The server records this after the money moves.
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Next recipient</CardDescription>
            <CardTitle className="text-2xl font-semibold leading-tight">
              {running ? 'Assigned' : 'Not set'}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {running ? 'Turns assigned' : 'Order unset'}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">
              {running
                ? 'Open a locked circle to see the turns'
                : 'Nobody is assigned the pot'}
            </div>
            <div className="text-muted-foreground">
              The creator locks the circle to assign one random turn each.
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Paid this month</CardDescription>
            <CardTitle className="text-2xl font-semibold leading-tight">
              {paid}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">No payment record</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">
              Paid status is not counted here
            </div>
            <div className="text-muted-foreground">
              A member who has not paid does not receive that month&apos;s pot.
            </div>
          </CardFooter>
        </Card>
      </section>
      <div className="px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>This month</CardTitle>
            <CardDescription>
              What you owe, whether it is paid, and who receives the pot.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">{due}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground sm:px-6">
            {circles.length === 0 ? (
              <p>
                No circle is running, so there is no contribution to pay and no
                pot to send.
              </p>
            ) : (
              <ul className="grid gap-3">
                {circles.map((circle) => (
                  <li key={circle.id}>
                    <span className="font-medium text-foreground">
                      {circle.name}
                    </span>
                    {circle.status === 'forming'
                      ? ' has not started. Nobody is due, and the payout order is not set.'
                      : ' is running. Payment status is recorded by the server after the money moves.'}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <CircleList circles={circles} />
    </>
  );
}
