import { Inject, Injectable } from '@nestjs/common';
import type { CreditRecord } from '@repo/api';

import { CircleNotFoundError } from '../../circles/domain/errors';
import { CirclesService } from '../../circles/application/circles.service';
import { CreditService } from '../../credit/application/credit.service';
import { PaypalService } from '../../paypal/application/paypal.service';
import {
  circleBrief,
  preparePayout,
  type PaypalDestination,
} from '../domain/circle-brief';
import { TREASURER_INSTRUCTIONS } from '../domain/instructions';
import type { TreasurerAsk } from '../domain/parse-treasurer-input';
import {
  TREASURER_MODEL,
  TREASURER_TOOLS,
  type TreasurerCircles,
  type TreasurerCredit,
  type TreasurerModel,
  type TreasurerPaypal,
  type TreasurerToolName,
} from './ports';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_EVENTS = 12;

@Injectable()
export class TreasurerService {
  constructor(
    @Inject(CirclesService) private readonly circles: TreasurerCircles,
    @Inject(CreditService) private readonly credit: TreasurerCredit,
    @Inject(PaypalService) private readonly paypal: TreasurerPaypal,
    @Inject(TREASURER_MODEL) private readonly model: TreasurerModel,
  ) {}

  async ask(userId: string, input: TreasurerAsk): Promise<string> {
    const message = input.circleId
      ? `The member is looking at circle ${input.circleId}.\n\n${input.message}`
      : input.message;
    const text = await this.model.answer({
      instructions: TREASURER_INSTRUCTIONS,
      message,
      tools: TREASURER_TOOLS,
      callTool: (name, args) =>
        this.callTool(userId, input.circleId, name, args),
    });
    const reply = text.trim();

    return reply.length > 0
      ? reply
      : 'I could not answer that. Ask about charges, the score, or whether this round is ready to pay out.';
  }

  private async callTool(
    userId: string,
    viewingCircleId: string | null,
    name: string,
    args: unknown,
  ): Promise<unknown> {
    const circleId = circleIdFrom(args, viewingCircleId);

    try {
      switch (name as TreasurerToolName) {
        case 'list_circles':
          return await this.circles.listForUser(userId);
        case 'read_circle':
          return await this.readCircle(userId, circleId);
        case 'read_credit':
          return await this.readCredit(userId, circleId);
        case 'prepare_round_payout':
          return await this.prepareRoundPayout(userId, circleId);
        default:
          return { error: 'Unknown tool.' };
      }
    } catch (error) {
      if (error instanceof CircleNotFoundError) {
        return { error: 'Circle not found.' };
      }

      return { error: 'That circle could not be read.' };
    }
  }

  private async readCircle(
    userId: string,
    circleId: string | null,
  ): Promise<unknown> {
    if (!circleId) {
      return { error: 'Name a circle first.' };
    }

    return circleBrief(await this.circles.getForMember(userId, circleId));
  }

  private async readCredit(
    userId: string,
    circleId: string | null,
  ): Promise<unknown> {
    const credit = await this.credit.read(userId);

    return presentCredit(credit, circleId);
  }

  private async prepareRoundPayout(
    userId: string,
    circleId: string | null,
  ): Promise<unknown> {
    if (!circleId) {
      return { error: 'Name a circle first.' };
    }

    const circle = await this.circles.getForMember(userId, circleId);
    const recipient = circle.members.find(
      (member) => member.payoutPosition === circle.currentRound,
    );
    const roundPaid =
      circle.viewerIsCreator &&
      circle.status === 'active' &&
      circle.currentRound !== null &&
      recipient !== undefined &&
      circle.members.every((member) => member.contributionStatus === 'paid');

    if (!roundPaid || !recipient) {
      return preparePayout(circle, null);
    }

    return preparePayout(
      circle,
      await this.destination(userId, circle.id, recipient.username),
    );
  }

  private async destination(
    viewerId: string,
    circleId: string,
    username: string,
  ): Promise<PaypalDestination | null> {
    const recipientId = await this.circles.memberUserId(
      viewerId,
      circleId,
      username,
    );

    if (!recipientId) {
      return null;
    }

    const status = await this.paypal.statusForUser(recipientId);

    if (!status.account) {
      return null;
    }

    return {
      fullName: status.account.fullName,
      email: status.account.email,
      payerId: status.account.payerId,
    };
  }
}

function presentCredit(credit: CreditRecord, circleId: string | null) {
  const events = (
    circleId
      ? credit.events.filter((event) => event.circleId === circleId)
      : credit.events
  ).slice(0, RECENT_EVENTS);
  const memberships = circleId
    ? credit.memberships.filter(
        (membership) => membership.circleId === circleId,
      )
    : credit.memberships;

  return {
    points: credit.points,
    memberships,
    events,
  };
}

function circleIdFrom(
  args: unknown,
  viewingCircleId: string | null,
): string | null {
  if (typeof args === 'object' && args !== null && 'circleId' in args) {
    const value = (args as { circleId?: unknown }).circleId;

    if (typeof value === 'string' && UUID.test(value)) {
      return value;
    }
  }

  return viewingCircleId;
}
