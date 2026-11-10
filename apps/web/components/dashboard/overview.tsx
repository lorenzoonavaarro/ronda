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
  const active = circles.filter((circle) => circle.status === 'active');
  const forming = circles.filter((circle) => circle.status === 'forming');
  const completed = circles.filter((circle) => circle.status === 'completed');

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
                {active.length} active
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">Groups you belong to</div>
            <div className="text-muted-foreground">
              {forming.length} forming · {completed.length} completed
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Circles to finish</CardDescription>
            <CardTitle className="text-2xl font-semibold leading-tight">
              {forming.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">Setup</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">Fill seats and lock</div>
            <div className="text-muted-foreground">
              Every member joins before the creator can assign turns.
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Active rounds</CardDescription>
            <CardTitle className="text-2xl font-semibold leading-tight">
              {active.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">In progress</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">Track each circle</div>
            <div className="text-muted-foreground">
              Open a circle to see payments, turns, and payout readiness.
            </div>
          </CardFooter>
        </Card>
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Next action</CardDescription>
            <CardTitle className="text-2xl font-semibold leading-tight">
              {forming.length > 0
                ? 'Finish setup'
                : active.length > 0
                  ? 'Track round'
                  : 'Create circle'}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">Suggested</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 font-medium">Keep the group moving</div>
            <div className="text-muted-foreground">
              The circle page shows the exact action required next.
            </div>
          </CardFooter>
        </Card>
      </section>
      <div className="px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>This month</CardTitle>
            <CardDescription>
              Your circles and the next step for each one.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">{circles.length} total</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-4 text-sm text-muted-foreground sm:px-6">
            {circles.length === 0 ? (
              <p>
                Create a circle or join one to start saving with a group.
              </p>
            ) : (
              <ul className="grid gap-3">
                {circles.map((circle) => (
                  <li key={circle.id}>
                    <span className="font-medium text-foreground">
                      {circle.name}
                    </span>
                    {circle.status === 'forming'
                      ? ` needs ${circle.membersRequired - circle.memberCount} more member${circle.membersRequired - circle.memberCount === 1 ? '' : 's'} before it can be locked.`
                      : circle.status === 'active'
                        ? ' is active. Open it to track the current round and payout.'
                        : ' is completed. Its history remains available.'}
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
