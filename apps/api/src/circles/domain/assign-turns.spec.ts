import { describe, expect, it } from '@jest/globals';

import { sameMembers, shuffled } from './assign-turns';

describe('shuffled', () => {
  it('keeps every member once', () => {
    const members = ['a', 'b', 'c', 'd', 'e', 'f'];
    const order = shuffled(members);

    expect(sameMembers(members, order)).toBe(true);
    expect(order).not.toBe(members);
  });

  it('follows the supplied random index', () => {
    expect(shuffled(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
  });
});
