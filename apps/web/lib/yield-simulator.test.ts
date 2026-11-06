import assert from 'node:assert/strict';
import test from 'node:test';

import { interestMinor, projectCircleYield } from './yield-simulator.ts';

const members = [
  {
    displayName: 'Lorenzo',
    username: 'lorenzonavarro',
    payoutPosition: 1,
    contributionStatus: 'paid' as const,
  },
  {
    displayName: 'Valentin',
    username: 'valentin',
    payoutPosition: 2,
    contributionStatus: 'paid' as const,
  },
];

test('counts one day on the charge date and posts on day 7', () => {
  const started = projectCircleYield({
    chargesBeginOn: '2026-11-06',
    monthlyAmountMinor: 5000,
    membersRequired: 2,
    asOf: '2026-11-06',
    members,
  });
  const posted = projectCircleYield({
    chargesBeginOn: '2026-11-06',
    monthlyAmountMinor: 5000,
    membersRequired: 2,
    asOf: '2026-11-13',
    members,
  });

  assert.equal(interestMinor(10000, 7), 8);
  assert.equal(started?.rounds[0]?.state, 'earning');
  assert.equal(started?.rounds[0]?.days, 1);
  assert.equal(started?.rounds[0]?.interestMinor, 1);
  assert.equal(started?.rounds[1]?.state, 'not_started');
  assert.equal(started?.earningMinor, 1);
  assert.equal(started?.availableMinor, 0);
  assert.equal(started?.splitReady, false);
  assert.equal(posted?.rounds[0]?.state, 'posted');
  assert.equal(posted?.rounds[0]?.payoutOn, '2026-11-13');
  assert.equal(posted?.availableMinor, 8);
  assert.equal(posted?.earningMinor, 0);
});

test('splits the posted yield after the last pot is sent', () => {
  const projection = projectCircleYield({
    chargesBeginOn: '2026-11-06',
    monthlyAmountMinor: 5000,
    membersRequired: 2,
    asOf: '2026-12-13',
    members,
  });

  assert.equal(projection?.rounds[1]?.chargeOn, '2026-12-06');
  assert.equal(projection?.rounds[1]?.state, 'posted');
  assert.equal(projection?.availableMinor, 16);
  assert.equal(projection?.splitReady, true);
  assert.deepEqual(
    projection?.shares.map((share) => [share.username, share.amountMinor]),
    [
      ['lorenzonavarro', 8],
      ['valentin', 8],
    ],
  );
});

test('gives a leftover cent to the latest turn and clamps short months', () => {
  const projection = projectCircleYield({
    chargesBeginOn: '2026-01-31',
    monthlyAmountMinor: 978,
    membersRequired: 2,
    asOf: '2026-03-07',
    members: [
      members[0],
      members[1],
      {
        displayName: 'Ada',
        username: 'ada',
        payoutPosition: 3,
        contributionStatus: 'paid',
      },
      {
        displayName: 'Skipped',
        username: 'skipped',
        payoutPosition: 4,
        contributionStatus: 'failed',
      },
    ],
  });

  assert.equal(projection?.rounds[1]?.chargeOn, '2026-02-28');
  assert.equal(projection?.rounds[1]?.payoutOn, '2026-03-07');
  assert.equal(interestMinor(1956, 7), 2);
  assert.equal(projection?.availableMinor, 4);
  assert.deepEqual(
    projection?.shares.map((share) => [share.username, share.amountMinor]),
    [
      ['lorenzonavarro', 1],
      ['valentin', 1],
      ['ada', 2],
    ],
  );
});
