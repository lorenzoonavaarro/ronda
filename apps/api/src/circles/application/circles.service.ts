import { randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CircleDetail, CircleSummary } from '@repo/api';

import { CreditService } from '../../credit/application/credit.service';
import type { ChargeView } from '../../charges/application/charges.service';
import { CHARGE_READER } from '../../charges/application/ports';
import { chargeDayFromDate } from '../../charges/domain/charge-calendar';
import { shuffled } from '../domain/assign-turns';
import type { CircleDetailRecord, CircleRecord } from '../domain/circle';
import {
  MEMBERS_REQUIRED_TO_START,
  visibleInCircleDirectory,
} from '../domain/circle';
import {
  CircleClosedError,
  CircleForbiddenError,
  CircleFullError,
  CircleLockedError,
  CircleNotFoundError,
  CircleNotReadyError,
  InvalidCircleInputError,
} from '../domain/errors';
import {
  parseCircleSettings,
  parseCreateCircle,
} from '../domain/parse-circle-input';
import { parseInviteToken } from '../domain/parse-join';
import { CIRCLE_REPOSITORY, type CircleRepository } from './ports';

@Injectable()
export class CirclesService {
  clock: () => Date = () => new Date();
  inviteTokens: () => string = () => randomBytes(32).toString('base64url');
  orderMembers: (userIds: string[]) => string[] = shuffled;

  constructor(
    @Inject(CIRCLE_REPOSITORY) private readonly circles: CircleRepository,
    @Optional() private readonly credit?: CreditService,
    @Optional()
    @Inject(CHARGE_READER)
    private readonly chargeReader?: {
      view(
        input: {
          circleId: string;
          chargesBeginOn: string | null;
          membersRequired: number;
          memberIds: string[];
        },
        now: Date,
      ): Promise<ChargeView>;
    },
  ) {}

  async create(userId: string, body: unknown): Promise<CircleSummary> {
    const input = parseCreateCircle(body);
    const createdAt = this.clock();
    const id = randomUUID();
    const chargeDay = chargeDayFromDate(createdAt);

    await this.circles.create({
      id,
      name: input.name,
      monthlyAmountMinor: input.monthlyAmountMinor,
      createdBy: userId,
      createdAt,
      inviteToken: this.inviteTokens(),
      chargeDay,
      minimumCreditScore: input.minimumCreditScore,
    });

    return this.toSummary(
      {
        id,
        name: input.name,
        monthlyAmountMinor: input.monthlyAmountMinor,
        currency: 'USD',
        status: 'forming',
        createdBy: userId,
        createdAt,
        memberCount: 1,
        membersRequired: MEMBERS_REQUIRED_TO_START,
        minimumCreditScore: input.minimumCreditScore,
        chargeDay,
        chargesBeginOn: null,
      },
      userId,
    );
  }

  async listForUser(userId: string): Promise<CircleSummary[]> {
    const circles = await this.circles.listForUser(userId);
    return circles.map((circle) => this.toSummary(circle, userId));
  }

  async listAll(userId: string): Promise<CircleSummary[]> {
    const circles = await this.circles.listAll(userId);
    return circles
      .filter((circle) =>
        visibleInCircleDirectory({
          status: circle.status,
          memberCount: circle.memberCount,
          membersRequired: circle.membersRequired,
          viewerIsMember: circle.viewerIsMember,
        }),
      )
      .map((circle) =>
        this.toSummary(circle, userId, circle.viewerIsMember),
      );
  }

  async getForMember(userId: string, circleId: string): Promise<CircleDetail> {
    if (!isUuid(circleId)) {
      throw new CircleNotFoundError();
    }

    const circle = await this.circles.findForMember(userId, circleId);

    if (!circle) {
      throw new CircleNotFoundError();
    }

    return this.present(circle, userId);
  }

  async memberUserId(
    viewerId: string,
    circleId: string,
    username: string,
  ): Promise<string | null> {
    if (!isUuid(circleId)) {
      return null;
    }

    const circle = await this.circles.findForMember(viewerId, circleId);
    const member = circle?.members.find((item) => item.username === username);

    return member?.userId ?? null;
  }

  async join(userId: string, body: unknown): Promise<CircleDetail> {
    const token = parseInviteToken(body);
    const circle = await this.circles.findByInviteToken(token);

    if (!circle) {
      throw new CircleNotFoundError();
    }

    const score = this.credit ? await this.credit.score(userId) : 0;
    if (score < (circle.minimumCreditScore ?? 0)) {
      throw new CircleNotReadyError(
        `This circle requires a credit score of at least ${circle.minimumCreditScore ?? 0}.`,
      );
    }

    const result = await this.circles.addMember(
      circle.id,
      userId,
      this.clock(),
    );

    if (result === 'missing') {
      throw new CircleNotFoundError();
    }

    if (result === 'full') {
      throw new CircleFullError();
    }

    if (result === 'closed') {
      throw new CircleClosedError();
    }

    const joined = await this.circles.findForMember(userId, circle.id);

    if (!joined) {
      throw new CircleNotFoundError();
    }

    return this.present(joined, userId);
  }

  async updateSettings(
    userId: string,
    circleId: string,
    body: unknown,
  ): Promise<CircleDetail> {
    const input = parseCircleSettings(body);
    const result = await this.change(circleId, () =>
      this.circles.updateSettings(circleId, userId, input),
    );

    if (result === 'too_small') {
      throw new InvalidCircleInputError(
        'There are already more members than those seats.',
      );
    }

    if (result === 'forbidden') {
      throw new CircleForbiddenError();
    }

    if (result === 'locked') {
      throw new CircleLockedError();
    }

    return this.detailForMember(userId, circleId);
  }

  async lock(userId: string, circleId: string): Promise<CircleDetail> {
    const result = await this.change(circleId, () =>
      this.circles.lock(circleId, userId, this.orderMembers),
    );

    if (result === 'forbidden') {
      throw new CircleForbiddenError();
    }

    if (result === 'not_full') {
      throw new CircleNotReadyError();
    }

    if (result === 'already') {
      throw new CircleLockedError();
    }

    return this.detailForMember(userId, circleId);
  }

  private async change(
    circleId: string,
    work: () => Promise<
      | 'updated'
      | 'locked'
      | 'missing'
      | 'forbidden'
      | 'not_full'
      | 'already'
      | 'too_small'
    >,
  ): Promise<
    'updated' | 'locked' | 'forbidden' | 'not_full' | 'already' | 'too_small'
  > {
    if (!isUuid(circleId)) {
      throw new CircleNotFoundError();
    }

    const result = await work();

    if (result === 'missing') {
      throw new CircleNotFoundError();
    }

    return result;
  }

  private async detailForMember(
    userId: string,
    circleId: string,
  ): Promise<CircleDetail> {
    const circle = await this.circles.findForMember(userId, circleId);

    if (!circle) {
      throw new CircleNotFoundError();
    }

    return this.present(circle, userId);
  }

  private async present(
    circle: CircleDetailRecord,
    userId: string,
  ): Promise<CircleDetail> {
    const view = this.chargeReader
      ? await this.chargeReader.view(
          {
            circleId: circle.id,
            chargesBeginOn: circle.chargesBeginOn,
            membersRequired: circle.membersRequired,
            memberIds: circle.members.map((member) => member.userId),
          },
          this.clock(),
        )
      : emptyChargeView();

    return this.toDetail(circle, userId, view);
  }

  private toSummary(
    circle: CircleRecord,
    userId: string,
    viewerIsMember = true,
  ): CircleSummary {
    return {
      id: circle.id,
      name: circle.name,
      monthlyAmountMinor: circle.monthlyAmountMinor,
      currency: 'USD',
      status: circle.status,
      memberCount: circle.memberCount,
      membersRequired: circle.membersRequired,
      minimumCreditScore: circle.minimumCreditScore ?? 0,
      createdByDisplayName: circle.createdByDisplayName ?? 'Unknown member',
      createdByUsername: circle.createdByUsername ?? 'unknown',
      viewerIsCreator: circle.createdBy === userId,
      viewerIsMember,
    };
  }

  private async toDetail(
    circle: CircleDetailRecord,
    userId: string,
    view: ChargeView,
  ): Promise<CircleDetail> {
    const members = [...circle.members].sort((left, right) => {
      if (left.payoutPosition === null || right.payoutPosition === null) {
        return left.payoutPosition === right.payoutPosition
          ? 0
          : left.payoutPosition === null
            ? 1
            : -1;
      }

      return left.payoutPosition - right.payoutPosition;
    });
    const scores = await Promise.all(
      members.map((member) =>
        this.credit ? this.credit.score(member.userId) : Promise.resolve(0),
      ),
    );

    return {
      ...this.toSummary(circle, userId),
      inviteToken: circle.inviteToken,
      createdAt: circle.createdAt.toISOString(),
      chargeDay: circle.chargeDay,
      chargesBeginOn: circle.chargesBeginOn,
      potCollectedMinor: view.potCollectedMinor,
      currentRound: view.currentRound,
      viewerChargeApproved: view.approvedUserIds.has(userId),
      members: members.map((member, index) => ({
          displayName: member.displayName,
          username: member.username,
          creator: member.creator,
          creditScore: scores[index] ?? 0,
          reputation: reputationFor(scores[index] ?? 0),
          payoutPosition: member.payoutPosition,
          chargeApproved: view.approvedUserIds.has(member.userId),
          contributionStatus:
            view.statusByUserId.get(member.userId) ??
            (view.currentRound === null ? 'not_due' : 'due'),
        })),
      yield: {
        status: 'not_earning',
        earnedMinor: null,
        availableMinor: null,
      },
    };
  }
}

function emptyChargeView(): ChargeView {
  return {
    potCollectedMinor: 0,
    currentRound: null,
    approvedUserIds: new Set(),
    statusByUserId: new Map(),
  };
}

function reputationFor(
  score: number,
): 'top_member' | 'trusted_member' | 'building_reputation' | 'new_member' {
  if (score >= 80) {
    return 'top_member';
  }

  if (score >= 40) {
    return 'trusted_member';
  }

  if (score > 0) {
    return 'building_reputation';
  }

  return 'new_member';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
