import { describe, expect, it } from '@jest/globals';

import {
  paperFreeze,
  paperGrantTarget,
  roundsStillOwed,
} from './paper-grant';

describe('paper grant', () => {
  it('counts every unpaid round plus the rounds after the current one', () => {
    expect(
      roundsStillOwed({
        monthlyAmountMinor: 15000,
        membersRequired: 8,
        currentRound: 7,
        currentRoundPaid: true,
      }),
    ).toBe(1);
    expect(
      roundsStillOwed({
        monthlyAmountMinor: 15000,
        membersRequired: 8,
        currentRound: 7,
        currentRoundPaid: false,
      }),
    ).toBe(2);
    expect(
      roundsStillOwed({
        monthlyAmountMinor: 15000,
        membersRequired: 8,
        currentRound: null,
        currentRoundPaid: false,
      }),
    ).toBe(8);
    expect(
      roundsStillOwed({
        monthlyAmountMinor: 15000,
        membersRequired: 8,
        currentRound: 8,
        currentRoundPaid: true,
      }),
    ).toBe(0);
  });

  it('sets aside the remaining dues and one extra month before paper cash', () => {
    const grant = paperGrantTarget({
      payoutsReceivedMinor: 120000,
      circles: [
        {
          monthlyAmountMinor: 15000,
          membersRequired: 8,
          currentRound: 7,
          currentRoundPaid: true,
        },
      ],
    });

    expect(grant).toEqual({
      targetMinor: 90000,
      obligationsMinor: 15000,
      bufferMinor: 15000,
    });
  });

  it('releases the reserve once nothing is owed', () => {
    const grant = paperGrantTarget({
      payoutsReceivedMinor: 120000,
      circles: [
        {
          monthlyAmountMinor: 15000,
          membersRequired: 8,
          currentRound: 8,
          currentRoundPaid: true,
        },
      ],
    });

    expect(grant.targetMinor).toBe(120000);
    expect(grant.bufferMinor).toBe(0);
  });

  it('pauses purchases for a miss before a reserve shortfall', () => {
    expect(
      paperFreeze({
        hasMissedContribution: true,
        hasReversedPayout: false,
        grantedMinor: 100,
        targetMinor: 0,
      }),
    ).toBe('missed_contribution');
    expect(
      paperFreeze({
        hasMissedContribution: false,
        hasReversedPayout: false,
        grantedMinor: 100,
        targetMinor: 40,
      }),
    ).toBe('reserve_short');
    expect(
      paperFreeze({
        hasMissedContribution: false,
        hasReversedPayout: false,
        grantedMinor: 40,
        targetMinor: 40,
      }),
    ).toBeNull();
    expect(
      paperFreeze({
        hasMissedContribution: false,
        hasReversedPayout: true,
        grantedMinor: 100,
        targetMinor: 40,
      }),
    ).toBe('payout_reversed');
  });
});
