import type { ActivityRecord, ActivityTurn, CircleSummary } from '@repo/api';
import { Badge } from '@repo/ui/components/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { ActivityPanel } from './activity-panel';
import { CircleList } from './circle-list';

export function Overview({
  circles,
  activity,
}: {
  circles: CircleSummary[];
  activity: ActivityRecord;
}) {
  const turns = new Map(activity.turns.map((turn) => [turn.circleId, turn]));

  return (
    <>
      <ActivityPanel activity={activity} />
      <div className="px-4 lg:px-6">
        <Card className="@container/card">
          <CardHeader>
            <CardTitle>Next step</CardTitle>
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
                    {turnSentence(turns.get(circle.id))}
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
      <CircleList circles={circles} title="Your circles" />
    </>
  );
}

function turnSentence(turn: ActivityTurn | undefined): string {
  if (!turn || turn.payoutPosition === null || turn.state === 'forming') {
    return '';
  }

  if (turn.state === 'received') {
    return ` Turn ${turn.payoutPosition} already received.`;
  }

  if (turn.currentRound === null) {
    return ` Turn ${turn.payoutPosition} has not started.`;
  }

  return ` Turn ${turn.payoutPosition}, round ${turn.currentRound}.`;
}
