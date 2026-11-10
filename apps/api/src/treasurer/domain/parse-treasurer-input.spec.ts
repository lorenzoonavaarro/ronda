import { describe, expect, it } from '@jest/globals';

import { InvalidTreasurerInputError } from './errors';
import { parseTreasurerAsk } from './parse-treasurer-input';

describe('parseTreasurerAsk', () => {
  it('keeps a message and an optional circle id', () => {
    expect(
      parseTreasurerAsk({
        message: '  Who still needs to approve?  ',
        circleId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual({
      message: 'Who still needs to approve?',
      circleId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rejects an empty message and a bad circle id', () => {
    expect(() => parseTreasurerAsk({ message: '   ' })).toThrow(
      InvalidTreasurerInputError,
    );
    expect(() =>
      parseTreasurerAsk({ message: 'Hello', circleId: 'not-a-circle' }),
    ).toThrow(InvalidTreasurerInputError);
  });
});
