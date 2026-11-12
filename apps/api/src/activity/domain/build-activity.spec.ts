import { describe, expect, it } from '@jest/globals';

import { buildActivity, type ActivityEvent, type ActivityMembership } from './build-activity';

const today = new Date(Date.UTC(2026, 10, 11, 15));

const rent: ActivityMembership = {
  circleId: 'rent',
  circleName: 'Rent share',
  status: 'active',
  monthlyAmountMinor: 15000,
  membersRequired: 8,
  chargesBeginOn: '2026-10-11',
  payoutPosition: 7,
};

describe('buildActivity', () => {
  it('sums the score, the on-time rate, and this month from paid rounds', () => {
    const activity = buildActivity(
      {
        events: [
          paid('rent', 'Rent share', 1, '2026-10-11'),
          paid('rent', 'Rent share', 2, '2026-11-11'),
        ],
        contributions: [
          { circleId: 'rent', roundNumber: 1, amountMinor: 15000, status: 'paid' },
          { circleId: 'rent', roundNumber: 2, amountMinor: 15000, status: 'paid' },
        ],
        memberships: [rent],
      },
      today,
    );

    expect(activity.points).toBe(20);
    expect(activity.onTimeCount).toBe(2);
    expect(activity.missedCount).toBe(0);
    expect(activity.onTimeRate).toBe(100);
    expect(activity.committedMinor).toBe(15000);
    expect(activity.paidThisRoundMinor).toBe(15000);
    expect(activity.score).toEqual([
      { occurredOn: '2026-10-11', points: 10 },
      { occurredOn: '2026-11-11', points: 20 },
    ]);
    expect(activity.months).toEqual([
      { month: '2026-10', paidMinor: 15000, missedMinor: 0 },
      { month: '2026-11', paidMinor: 15000, missedMinor: 0 },
    ]);
    expect(activity.turns[0]).toMatchObject({
      circleName: 'Rent share',
      currentRound: 2,
      state: 'waiting',
    });
    expect(activity.entries.map((entry) => entry.roundNumber)).toEqual([2, 1]);
  });

  it('keeps a miss and a pot default out of the on-time count', () => {
    const activity = buildActivity(
      {
        events: [
          paid('tools', 'Tools fund', 1, '2026-08-11'),
          missed('tools', 'Tools fund', 2, '2026-09-11'),
          {
            circleId: 'tools',
            circleName: 'Tools fund',
            roundNumber: 1,
            eventType: 'pot_defaulted',
            points: -40,
            occurredOn: '2026-08-11',
          },
        ],
        contributions: [
          { circleId: 'tools', roundNumber: 1, amountMinor: 4000, status: 'paid' },
          { circleId: 'tools', roundNumber: 2, amountMinor: 4000, status: 'failed' },
        ],
        memberships: [
          {
            circleId: 'tools',
            circleName: 'Tools fund',
            status: 'completed',
            monthlyAmountMinor: 4000,
            membersRequired: 4,
            chargesBeginOn: '2026-08-11',
            payoutPosition: 1,
          },
        ],
      },
      today,
    );

    expect(activity.points).toBe(-45);
    expect(activity.onTimeRate).toBe(50);
    expect(activity.committedMinor).toBe(0);
    expect(activity.months).toEqual([
      { month: '2026-08', paidMinor: 4000, missedMinor: 0 },
      { month: '2026-09', paidMinor: 0, missedMinor: 4000 },
    ]);
    expect(activity.entries[0]).toMatchObject({
      status: 'failed',
      points: -15,
      amountMinor: 4000,
    });
    expect(activity.entries.find((entry) => entry.status === 'defaulted')).toMatchObject({
      amountMinor: null,
      points: -40,
      roundNumber: null,
    });
    expect(activity.turns[0]?.state).toBe('received');
  });

  it('leaves the rate empty when nothing has been decided', () => {
    const activity = buildActivity(
      {
        events: [],
        contributions: [],
        memberships: [
          {
            ...rent,
            circleId: 'sunday',
            circleName: 'Sunday groceries',
            status: 'forming',
            chargesBeginOn: null,
            payoutPosition: null,
          },
        ],
      },
      today,
    );

    expect(activity.onTimeRate).toBeNull();
    expect(activity.score).toEqual([]);
    expect(activity.committedMinor).toBe(0);
    expect(activity.turns[0]?.state).toBe('forming');
  });

  it('marks a turn received once the current round reaches it', () => {
    const activity = buildActivity(
      {
        events: [],
        contributions: [],
        memberships: [{ ...rent, payoutPosition: 1 }],
      },
      today,
    );

    expect(activity.turns[0]).toMatchObject({
      payoutPosition: 1,
      currentRound: 2,
      state: 'received',
    });
  });
});

function paid(
  circleId: string,
  circleName: string,
  roundNumber: number,
  occurredOn: string,
): ActivityEvent {
  return {
    circleId,
    circleName,
    roundNumber,
    eventType: 'contribution_paid',
    points: 10,
    occurredOn,
  };
}

function missed(
  circleId: string,
  circleName: string,
  roundNumber: number,
  occurredOn: string,
): ActivityEvent {
  return {
    circleId,
    circleName,
    roundNumber,
    eventType: 'contribution_missed',
    points: -15,
    occurredOn,
  };
}
