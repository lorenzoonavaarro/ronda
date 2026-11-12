'use client';

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
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { formatUsd } from '../../lib/money';

const statuses = ['all', 'forming', 'active', 'completed'] as const;
const MAX_MONTHLY_AMOUNT_MINOR = 150_000;

type StatusFilter = (typeof statuses)[number];

export function CircleList({
  circles,
  searchable = false,
}: {
  circles: CircleSummary[];
  searchable?: boolean;
}) {
  const [name, setName] = useState('');
  const [circleId, setCircleId] = useState('');
  const [minimumScore, setMinimumScore] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [maxAmountMinor, setMaxAmountMinor] = useState<number | null>(null);
  const [openSeats, setOpenSeats] = useState(false);
  const [createdByYou, setCreatedByYou] = useState(false);

  const effectiveMaxAmount = Math.min(
    maxAmountMinor ?? MAX_MONTHLY_AMOUNT_MINOR,
    MAX_MONTHLY_AMOUNT_MINOR,
  );

  const visible = useMemo(() => {
    const query = name.trim().toLowerCase();
    const idQuery = circleId.trim().toLowerCase();
    const scoreQuery =
      minimumScore.trim() === '' ? null : Number(minimumScore);

    return circles.filter((circle) => {
      if (query && !circle.name.toLowerCase().includes(query)) {
        return false;
      }

      if (idQuery && !circle.id.toLowerCase().includes(idQuery)) {
        return false;
      }

      if (
        scoreQuery !== null &&
        Number.isFinite(scoreQuery) &&
        (circle.minimumCreditScore ?? 0) < scoreQuery
      ) {
        return false;
      }

      if (status !== 'all' && circle.status !== status) {
        return false;
      }

      if (circle.monthlyAmountMinor > effectiveMaxAmount) {
        return false;
      }

      if (openSeats && circle.memberCount >= circle.membersRequired) {
        return false;
      }

      if (createdByYou && !circle.viewerIsCreator) {
        return false;
      }

      return true;
    });
  }, [
    circleId,
    circles,
    createdByYou,
    effectiveMaxAmount,
    name,
    minimumScore,
    openSeats,
    status,
  ]);

  if (circles.length === 0) {
    return (
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>No circle yet</CardTitle>
            <CardDescription>
              A circle locks when every seat is filled and you assign the turns.
              You can set it from 2 to 12 seats, and change the name and monthly
              amount, until then. Nothing is due until a payment exists.
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
    <div className="grid gap-4 px-4 lg:px-6">
      {searchable ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="grid gap-2">
            <Label htmlFor="circle-search">Search circles</Label>
            <Input
              id="circle-search"
              value={name}
              placeholder="Search by name"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="circle-id-search">Search by circle ID</Label>
            <Input
              id="circle-id-search"
              value={circleId}
              placeholder="Paste a circle ID"
              onChange={(event) => setCircleId(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {statuses.map((item) => (
              <button
                key={item}
                type="button"
                className={buttonVariants({
                  variant: status === item ? 'default' : 'outline',
                  size: 'sm',
                })}
                onClick={() => setStatus(item)}
              >
                {item === 'all' ? 'Any status' : statusLabel(item)}
              </button>
            ))}
            <button
              type="button"
              className={buttonVariants({
                variant: openSeats ? 'default' : 'outline',
                size: 'sm',
              })}
              onClick={() => setOpenSeats((current) => !current)}
            >
              Open seats
            </button>
            <button
              type="button"
              className={buttonVariants({
                variant: createdByYou ? 'default' : 'outline',
                size: 'sm',
              })}
              onClick={() => setCreatedByYou((current) => !current)}
            >
              Created by you
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="max-amount">Maximum monthly payment</Label>
                <span className="text-sm text-muted-foreground">
                  {formatUsd(effectiveMaxAmount)}
                </span>
              </div>
              <input
                id="max-amount"
                type="range"
                min={0}
                max={MAX_MONTHLY_AMOUNT_MINOR}
                step={100}
                value={effectiveMaxAmount}
                onChange={(event) =>
                  setMaxAmountMinor(Number(event.target.value))
                }
                className="w-full accent-primary"
                aria-label="Maximum monthly payment"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="minimum-score-search">
                  Minimum score requirement
                </Label>
                <span className="text-sm text-muted-foreground">
                  {minimumScore.trim() === '' ? 'Any' : minimumScore}
                </span>
              </div>
              <input
                id="minimum-score-search"
                type="range"
                min={0}
                max={1000}
                step={1}
                value={minimumScore === '' ? 0 : Number(minimumScore)}
                onChange={(event) => setMinimumScore(event.target.value)}
                className="w-full accent-primary"
                aria-label="Minimum score requirement"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Circles with an open seat, plus the circles you belong to. Filter
            by name, ID, status, maximum monthly amount, open seats, or circles
            you created.
          </p>
        </form>
      ) : null}
      {visible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matching circle</CardTitle>
            <CardDescription>No circle matches this search.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((circle) => {
            const card = (
              <Card
                className={`h-full ${circle.viewerIsMember ? 'transition-colors hover:bg-muted/40' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{circle.name}</CardTitle>
                    <div className="flex shrink-0 gap-2">
                      {searchable && circle.viewerIsMember ? (
                        <Badge variant="outline">Yours</Badge>
                      ) : null}
                      <Badge variant="outline">
                        {statusLabel(circle.status)}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {formatUsd(circle.monthlyAmountMinor)} each month
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span>
                      {circle.memberCount} of {circle.membersRequired} members
                    </span>
                    <span className="text-xs">
                      {circle.memberCount >= circle.membersRequired
                        ? 'Full'
                        : `${circle.membersRequired - circle.memberCount} open`}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    aria-label={`${circle.memberCount} of ${circle.membersRequired} seats filled`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          (circle.memberCount / circle.membersRequired) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3">{cardNote(circle)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span>
                      Created by {circle.createdByDisplayName ?? 'Unknown member'}
                    </span>
                    <Badge className={scoreTagClass(circle.minimumCreditScore ?? 0)}>
                      Score {circle.minimumCreditScore ?? 0} required
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );

            return circle.viewerIsMember ? (
              <Link
                key={circle.id}
                href={`/circles/${circle.id}`}
                className="block"
              >
                {card}
              </Link>
            ) : (
              <div key={circle.id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function cardNote(circle: CircleSummary): string {
  if (circle.viewerIsMember) {
    if (circle.status === 'forming') {
      return 'Next: fill the seats, then lock the circle.';
    }

    if (circle.status === 'active') {
      return 'Next: track contributions and the current payout turn.';
    }

    return 'Completed circle history.';
  }

  if (
    circle.status === 'forming' &&
    circle.memberCount < circle.membersRequired
  ) {
    return 'You are not in this circle. An invite is required to join.';
  }

  if (circle.status === 'forming') {
    return 'You are not in this circle. It is full.';
  }

  return 'You are not in this circle.';
}

function statusLabel(status: CircleSummary['status']): string {
  if (status === 'forming') {
    return 'Forming';
  }

  if (status === 'active') {
    return 'Locked';
  }

  return 'Completed';
}

function scoreTagClass(score: number): string {
  if (score >= 80) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
  }

  if (score >= 40) {
    return 'border-blue-500/40 bg-blue-500/10 text-blue-700';
  }

  if (score > 0) {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  }

  return 'border-muted-foreground/30 bg-muted text-muted-foreground';
}
