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

import { dollarsToMinor, formatUsd } from '../../lib/money';

const statuses = ['all', 'forming', 'active', 'completed'] as const;

type StatusFilter = (typeof statuses)[number];

export function CircleList({
  circles,
  searchable = false,
}: {
  circles: CircleSummary[];
  searchable?: boolean;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [openSeats, setOpenSeats] = useState(false);
  const [createdByYou, setCreatedByYou] = useState(false);

  const minMinor = minAmount.trim() === '' ? null : dollarsToMinor(minAmount);
  const maxMinor = maxAmount.trim() === '' ? null : dollarsToMinor(maxAmount);
  const amountError =
    (minAmount.trim() !== '' && minMinor === null) ||
    (maxAmount.trim() !== '' && maxMinor === null);

  const visible = useMemo(() => {
    const query = name.trim().toLowerCase();

    return circles.filter((circle) => {
      if (query && !circle.name.toLowerCase().includes(query)) {
        return false;
      }

      if (status !== 'all' && circle.status !== status) {
        return false;
      }

      if (minMinor !== null && circle.monthlyAmountMinor < minMinor) {
        return false;
      }

      if (maxMinor !== null && circle.monthlyAmountMinor > maxMinor) {
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
  }, [circles, createdByYou, maxMinor, minMinor, name, openSeats, status]);

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
              <Label htmlFor="min-amount">Minimum monthly</Label>
              <Input
                id="min-amount"
                inputMode="decimal"
                placeholder="1.00"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max-amount">Maximum monthly</Label>
              <Input
                id="max-amount"
                inputMode="decimal"
                placeholder="100000.00"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
              />
            </div>
          </div>
          {amountError ? (
            <p className="text-sm text-destructive">
              Enter monthly amounts in dollars, such as 50.00.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Filter by name, status, monthly amount, open seats, or circles you
              created.
            </p>
          )}
        </form>
      ) : null}
      {visible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matching circle</CardTitle>
            <CardDescription>
              None of your circles match this search.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((circle) => (
            <Link
              key={circle.id}
              href={`/circles/${circle.id}`}
              className="block"
            >
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{circle.name}</CardTitle>
                    <Badge variant="outline">
                      {statusLabel(circle.status)}
                    </Badge>
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
                  <p className="mt-3">
                    {circle.status === 'forming'
                      ? 'Next: fill the seats, then lock the circle.'
                      : circle.status === 'active'
                        ? 'Next: track contributions and the current payout turn.'
                        : 'Completed circle history.'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
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
