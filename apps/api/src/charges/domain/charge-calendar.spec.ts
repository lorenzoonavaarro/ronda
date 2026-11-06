import { describe, expect, it } from '@jest/globals';

import {
  addUtcMonths,
  chargeDayFromDate,
  currentRound,
  firstChargeOn,
  minorToPaypalValue,
  paypalValueToMinor,
} from './charge-calendar';

describe('charge calendar', () => {
  it('clamps a month-end creation date to day 28', () => {
    expect(chargeDayFromDate(new Date('2026-01-31T15:00:00Z'))).toBe(28);
    expect(chargeDayFromDate(new Date('2026-11-06T00:30:00Z'))).toBe(6);
  });

  it('uses the charge day in this month when it is still ahead', () => {
    expect(firstChargeOn(new Date('2026-11-06T00:00:00Z'), 6)).toBe(
      '2026-11-06',
    );
    expect(firstChargeOn(new Date('2026-11-07T00:00:00Z'), 6)).toBe(
      '2026-12-06',
    );
  });

  it('keeps the round on the latest charge date that has arrived', () => {
    expect(
      currentRound('2026-01-15', new Date('2026-01-14T00:00:00Z'), 6),
    ).toBe(null);
    expect(
      currentRound('2026-01-15', new Date('2026-01-15T00:00:00Z'), 6),
    ).toBe(1);
    expect(
      currentRound('2026-01-15', new Date('2026-02-14T00:00:00Z'), 6),
    ).toBe(1);
    expect(
      currentRound('2026-01-15', new Date('2026-02-15T00:00:00Z'), 6),
    ).toBe(2);
    expect(
      currentRound('2026-01-15', new Date('2026-08-15T00:00:00Z'), 6),
    ).toBe(6);
    expect(addUtcMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(
      currentRound('2026-01-31', new Date('2026-02-28T00:00:00Z'), 6),
    ).toBe(2);
    expect(
      currentRound('2026-01-31', new Date('2026-03-30T00:00:00Z'), 6),
    ).toBe(2);
    expect(
      currentRound('2026-01-31', new Date('2026-03-31T00:00:00Z'), 6),
    ).toBe(3);
  });

  it('converts minor units without fractions', () => {
    expect(minorToPaypalValue(2500)).toBe('25.00');
    expect(paypalValueToMinor('25.00')).toBe(2500);
    expect(paypalValueToMinor('25')).toBeNull();
  });
});
