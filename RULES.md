# Circle and market rules

These are the rules the app enforces today. Amounts are US dollars. A signed-in member is required for both the circle lists and the stock pages.

## Circles

A circle has a name of 1 to 60 characters, a monthly amount from $1.00 to $100,000.00, and 2 to 12 seats. A new circle starts with 6 seats and the status `forming`. The creator can change the name, the monthly amount, the seat count, and the minimum credit score until the circle is locked. The seat count cannot drop below the number of people already in the circle.

Joining uses an invite link. The circle must still be forming and must have an open seat. The member's credit score must be at least the circle's minimum. That minimum is an integer from 0 to 1,000. The score is the sum of credit events:

- A paid contribution is +10.
- A missed contribution is −15.
- A completed circle is +20, and only when every required round was paid and none failed.
- A defaulted pot is −40.

Member labels come from that score: 80 or more is a top member, 40 to 79 is trusted, 1 to 39 is building a reputation, and 0 or below is a new member.

The overview lists only circles the signed-in member belongs to. The Circles page lists every forming circle that still has an open seat, plus every circle that member belongs to. An active, full, or completed circle stays hidden from everyone who was not a member. A circle the viewer has not joined is not a link. Its invite token, settings, and payment history are not on that card. Opening a circle address requires membership.

The creator locks a circle only when every seat is filled. Locking assigns one random turn to each member and marks the circle active. Settings and new members stop there.

Charges do not start at lock. They start after every member has approved a PayPal payment method. The charge day is from 1 to 28. Round 1 is the first charge date, and each later round is one month after that. Everyone pays the same monthly amount each round. The member whose turn number equals the round receives the pot.

The creator confirms the payout. The circle must be active, the round must have started, and every member's contribution for that round must be paid. The recipient needs a verified PayPal email. The payout amount is what was collected for that round, and it is sent to that PayPal account. One payout exists per circle per round. A failed payout is not retried automatically.

## Market

The market is paper trading. A circle payout still goes to the member's PayPal. Stock orders do not move that money, and the app does not send circle funds to a broker.

The Stock page shows twelve names: Apple, Microsoft, Alphabet, Amazon, NVIDIA, Meta, Tesla, JPMorgan, Disney, Coca-Cola, the S&P 500 fund, and the Nasdaq 100 fund. Each price is the latest IEX trade from Alpaca. The change is that price minus the previous close. The board is cached for 30 seconds. Choosing a card fills that symbol into the order form. Any other symbol can be typed. A symbol is 1 to 5 letters, with an optional dot and 1 or 2 more letters, such as `AAPL` or `BRK.B`.

Prices require `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY` on the API. Without them, the names still appear, prices are unavailable, and orders are refused.

Paper cash is simulated. It increases only when this target is higher than the amount already granted:

`succeeded payouts − contributions still owed in active circles − one extra month of those circles`

An active circle whose charges have not started counts every seat as still owed. Once a round has started, the count is the current round if it is unpaid, plus every later round. A circle with nothing left to pay adds no reserve. Forming and completed circles are not part of this sum. Granted paper cash is never reduced. If the target falls, new buys pause and existing paper cash stays.

A buy also pauses, in this order, when:

1. The member has a failed contribution in an active circle.
2. Granted paper cash is above the current target because a PayPal payout that funded it no longer has the status succeeded.
3. Granted paper cash is above the current target for any other reason, including a new circle or a larger reserve.

Selling stays available in every pause. A sell cannot exceed the shares held. The proceeds return to paper cash only.

A buy cannot cost more than the paper cash. The smallest order is $0.01. Quantity is greater than 0, at most 100,000 shares, and at most four decimal places. There is no margin and no short sale. The fill price is the Alpaca price at the moment of the order. Portfolio shows paper cash, the latest value of the positions, and a round chart of those positions. It has no market board and no order form.
