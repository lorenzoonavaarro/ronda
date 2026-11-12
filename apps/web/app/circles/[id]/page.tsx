import { notFound } from 'next/navigation';

import { ApproveChargesLink } from '@/components/dashboard/approve-charges-link';
import { CircleSettings } from '@/components/dashboard/circle-settings';
import { InviteLink } from '@/components/dashboard/invite-link';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { YieldSimulator } from '@/components/dashboard/yield-simulator';
import { Badge } from '@repo/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/card';

import { CircleRounds } from '@/components/dashboard/circle-rounds';
import { CreditSummary } from '@/components/dashboard/credit-summary';
import { TreasurerPanel } from '@/components/dashboard/treasurer-panel';
import { ConfirmPayoutButton } from '@/components/dashboard/confirm-payout-button';

import { getCircle, getCircleRounds, getCredit, requireUser } from '../../../lib/api';
import { formatUsd } from '../../../lib/money';

export const dynamic = 'force-dynamic';

const chargeNotices: Record<string, string> = {
  approved: 'PayPal is saved for these charges.',
  denied: 'PayPal charge approval was cancelled. Nothing was saved.',
  unavailable: 'PayPal could not save this payment method.',
};

export default async function CircleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ charges?: string | string[] }>;
}) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const noticeKey = typeof query.charges === 'string' ? query.charges : '';
  const notice = chargeNotices[noticeKey];
  const [circle, credit, rounds] = await Promise.all([
    getCircle(id),
    getCredit(),
    getCircleRounds(id),
  ]);

  if (!circle) {
    notFound();
  }

  const seats = Math.max(circle.membersRequired - circle.memberCount, 0);
  const locked = circle.status !== 'forming';
  const turnsAssigned = circle.members.every(
    (member) => member.payoutPosition !== null,
  );
  const created = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(circle.createdAt));
  const waiting = circle.members.filter((member) => !member.chargeApproved);
  const paidMembers = circle.members.filter(
    (member) => member.contributionStatus === 'paid',
  ).length;
  const paymentProgress =
    circle.members.length === 0
      ? 0
      : Math.round((paidMembers / circle.members.length) * 100);

  return (
    <DashboardShell title={circle.name}>
      <div className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-6">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>Circle</CardTitle>
                <Badge variant="outline">{statusLabel(circle.status)}</Badge>
              </div>
              <CardDescription>
                Fixed monthly contribution, membership, and payout order.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {notice ? <p className="text-sm font-medium">{notice}</p> : null}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Fact
                  label="Monthly"
                  value={formatUsd(circle.monthlyAmountMinor)}
                />
                <Fact label="Currency" value={circle.currency} />
                <Fact
                  label="Members"
                  value={`${circle.memberCount} of ${circle.membersRequired}`}
                />
                <Fact
                  label="Open seats"
                  value={seats > 0 ? String(seats) : 'None'}
                />
                <Fact
                  label="Payout order"
                  value={turnsAssigned ? 'Assigned' : 'Not set'}
                />
                <Fact
                  label="Pot collected"
                  value={formatUsd(circle.potCollectedMinor)}
                />
                <Fact
                  label="First charge"
                  value={
                    circle.chargesBeginOn
                      ? formatUtcDate(circle.chargesBeginOn)
                      : 'Not started'
                  }
                />
                <Fact
                  label="Round"
                  value={
                    circle.currentRound === null
                      ? 'Not started'
                      : `${circle.currentRound} of ${circle.membersRequired}`
                  }
                />
                <Fact label="Created" value={created} />
                <Fact
                  label="Your role"
                  value={circle.viewerIsCreator ? 'Creator' : 'Member'}
                />
              </dl>
              <p className="text-sm text-muted-foreground">
                {chargeNote(circle, waiting)}
              </p>
              {circle.viewerChargeApproved ? null : (
                <ApproveChargesLink circleId={circle.id} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Round progress</CardTitle>
              <CardDescription>
                {circle.currentRound === null
                  ? 'The circle has not started charging yet.'
                  : `Round ${circle.currentRound} of ${circle.membersRequired}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold">
                    {formatUsd(circle.potCollectedMinor)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    collected from {paidMembers} of {circle.members.length}{' '}
                    members
                  </p>
                </div>
                <Badge
                  variant={paymentProgress === 100 ? 'default' : 'outline'}
                >
                  {paymentProgress}% paid
                </Badge>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-muted"
                aria-label={`${paymentProgress}% of contributions paid`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {paymentProgress === 100
                  ? 'The round can be reviewed for payout.'
                  : 'Every member must have a confirmed payment before the pool can be sent.'}
              </p>
            </CardContent>
          </Card>
          <CircleRounds rounds={rounds ?? { rounds: [] }} />
          {circle.viewerIsCreator && !locked ? (
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  You can change the name, monthly amount, and seats until you
                  lock the circle. A circle has 2 to 12 seats. Charges start on
                  the day every member has approved, then once each month.
                  Locking waits until every seat is filled, then assigns one
                  random turn to each member.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CircleSettings
                  key={`${circle.name}-${circle.monthlyAmountMinor}-${circle.membersRequired}-${circle.minimumCreditScore ?? 0}`}
                  circleId={circle.id}
                  name={circle.name}
                  monthlyAmountMinor={circle.monthlyAmountMinor}
                  memberCount={circle.memberCount}
                  membersRequired={circle.membersRequired}
                  minimumCreditScore={circle.minimumCreditScore ?? 0}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                {turnsAssigned
                  ? 'Each member has one turn. The order was assigned at random when the circle was locked.'
                  : 'Nobody has a turn until the creator locks the circle.'}
                {` Minimum score to join: ${circle.minimumCreditScore ?? 0}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {circle.members.map((member) => (
                <div
                  key={member.username}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{member.displayName}</p>
                    <p className="text-muted-foreground">{member.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.creator ? (
                      <Badge variant="secondary">Creator</Badge>
                    ) : null}
                    <Badge className={reputationClass(member.reputation)}>
                      {reputationLabel(member.reputation)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {contributionLabel(member.contributionStatus)}
                    </span>
                    <span className="text-muted-foreground">
                      {member.payoutPosition === null
                        ? 'Not set'
                        : `Turn ${member.payoutPosition}`}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Treasurer</CardTitle>
              <CardDescription>
                Asks about this circle's charges, score, and whether the round
                can be paid out. A payout proposal does not send money.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TreasurerPanel circleId={circle.id} />
              {circle.viewerIsCreator &&
              circle.currentRound !== null &&
              circle.status === 'active' &&
              circle.members.every(
                (member) => member.contributionStatus === 'paid',
              ) ? (
                <div className="mt-4 border-t pt-4">
                  <ConfirmPayoutButton circleId={circle.id} />
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invitation</CardTitle>
              <CardDescription>
                {locked
                  ? 'This circle is locked. The link no longer adds members, and the turns stay as they were assigned.'
                  : 'Share this link with someone who already has a Ronda account. Joining adds them as a member. Turns stay unset until the creator locks the circle.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <InviteLink token={circle.inviteToken} />
              <p className="text-sm text-muted-foreground">
                {locked
                  ? 'No more members can join.'
                  : seats > 0
                    ? `${seats} ${seats === 1 ? 'seat is' : 'seats are'} still open.`
                    : 'This circle is full. Lock it to assign turns.'}
              </p>
            </CardContent>
          </Card>
          {credit ? (
            <Card>
              <CardHeader>
                <CardTitle>Credit</CardTitle>
                <CardDescription>
                  One score for you, across every circle. This circle keeps its
                  own streak.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreditSummary credit={credit} circleId={circle.id} />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Yield</CardTitle>
              <CardDescription>
                Part of the pooled money earns interest after contributions are
                collected.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid gap-3 text-sm">
                <Fact label="Status" value="Not earning" />
                <Fact label="Earned" value="Not recorded" />
                <Fact label="Available" value="Not recorded" />
              </dl>
              <YieldSimulator
                chargesBeginOn={circle.chargesBeginOn}
                monthlyAmountMinor={circle.monthlyAmountMinor}
                membersRequired={circle.membersRequired}
                members={circle.members.map((member) => ({
                  displayName: member.displayName,
                  username: member.username,
                  payoutPosition: member.payoutPosition,
                  contributionStatus: member.contributionStatus,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function chargeNote(
  circle: {
    status: 'forming' | 'active' | 'completed';
    chargesBeginOn: string | null;
    currentRound: number | null;
    membersRequired: number;
  },
  waiting: { displayName: string }[],
): string {
  if (waiting.length > 0) {
    const names = waiting.map((member) => member.displayName).join(', ');
    return `Charges stay off until the circle is locked and every member approves PayPal for future charges. Still waiting on ${names}.`;
  }

  if (!circle.chargesBeginOn) {
    return circle.status === 'forming'
      ? 'Every member has approved charges. They start that day once the circle is locked, then once each month.'
      : 'Charges start on the UTC day every member approved, then once each month.';
  }

  const started = formatUtcDate(circle.chargesBeginOn);

  if (circle.currentRound === circle.membersRequired) {
    return `Charges started ${started} UTC. This is the last round.`;
  }

  return `Charges started ${started} UTC. The next charge is one month later.`;
}

function contributionLabel(
  status: 'paid' | 'due' | 'not_due' | 'failed' | 'refunded',
): string {
  if (status === 'paid') {
    return 'Paid';
  }

  if (status === 'due') {
    return 'Due';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  if (status === 'refunded') {
    return 'Refunded';
  }

  return 'Not due';
}

function reputationLabel(
  reputation:
    | 'top_member'
    | 'trusted_member'
    | 'building_reputation'
    | 'new_member'
    | undefined,
): string {
  if (reputation === 'top_member') {
    return 'Top member';
  }

  if (reputation === 'trusted_member') {
    return 'Trusted member';
  }

  if (reputation === 'building_reputation') {
    return 'Building reputation';
  }

  return 'New member';
}

function reputationClass(
  reputation:
    | 'top_member'
    | 'trusted_member'
    | 'building_reputation'
    | 'new_member'
    | undefined,
): string {
  if (reputation === 'top_member') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
  }

  if (reputation === 'trusted_member') {
    return 'border-blue-500/40 bg-blue-500/10 text-blue-700';
  }

  if (reputation === 'building_reputation') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  }

  return 'border-muted-foreground/30 bg-muted text-muted-foreground';
}

function statusLabel(status: 'forming' | 'active' | 'completed'): string {
  if (status === 'forming') {
    return 'Forming';
  }

  if (status === 'active') {
    return 'Locked';
  }

  return 'Completed';
}
