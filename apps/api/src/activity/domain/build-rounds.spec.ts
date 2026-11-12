import { describe, expect, it } from '@jest/globals';

import { buildCircleRounds } from './build-rounds';

const members = [
  {
    userId: 'maya',
    username: 'demo_maya',
    displayName: 'Maya Chen',
    payoutPosition: 1,
  },
  {
    userId: 'priya',
    username: 'demo_priya',
    displayName: 'Priya Shah',
    payoutPosition: 2,
  },
];

describe('buildCircleRounds', () => {
  it('lists every started round and marks a missing payment due', () => {
    const history = buildCircleRounds({
      chargesBeginOn: '2026-10-11',
      currentRound: 2,
      members,
      contributions: [
        { userId: 'maya', roundNumber: 1, status: 'paid' },
        { userId: 'priya', roundNumber: 1, status: 'paid' },
        { userId: 'maya', roundNumber: 2, status: 'paid' },
        { userId: 'priya', roundNumber: 2, status: 'failed' },
      ],
    });

    expect(history.rounds.map((round) => round.chargeOn)).toEqual([
      '2026-10-11',
      '2026-11-11',
    ]);
    expect(history.rounds[1]?.payments).toEqual([
      {
        username: 'demo_maya',
        displayName: 'Maya Chen',
        payoutPosition: 1,
        status: 'paid',
      },
      {
        username: 'demo_priya',
        displayName: 'Priya Shah',
        payoutPosition: 2,
        status: 'failed',
      },
    ]);
  });

  it('treats a pending row as due and stays empty before charges begin', () => {
    const started = buildCircleRounds({
      chargesBeginOn: '2026-11-11',
      currentRound: 1,
      members,
      contributions: [{ userId: 'maya', roundNumber: 1, status: 'pending' }],
    });
    const waiting = buildCircleRounds({
      chargesBeginOn: null,
      currentRound: null,
      members,
      contributions: [],
    });

    expect(started.rounds[0]?.payments.map((payment) => payment.status)).toEqual([
      'due',
      'due',
    ]);
    expect(waiting.rounds).toEqual([]);
  });
});
