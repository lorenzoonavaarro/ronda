import { describe, expect, it } from '@jest/globals';

import { CirclesService } from './circles.service';
import type {
  CircleLockResult,
  CircleRepository,
  CircleSettingsResult,
} from './ports';
import type {
  AddMemberResult,
  CircleDetailRecord,
  CircleRecord,
} from '../domain/circle';
import { MEMBERS_REQUIRED_TO_START } from '../domain/circle';
import { sameMembers } from '../domain/assign-turns';
import {
  CircleClosedError,
  CircleForbiddenError,
  CircleFullError,
  CircleLockedError,
  CircleNotFoundError,
  CircleNotReadyError,
  InvalidCircleInputError,
  InvalidInviteError,
} from '../domain/errors';

type StoredMember = {
  userId: string;
  joinedAt: Date;
  payoutPosition: number | null;
};

type Stored = CircleRecord & {
  inviteToken: string;
  members: StoredMember[];
};

class MemoryCircles implements CircleRepository {
  readonly rows: Stored[] = [];

  async create(input: {
    id: string;
    name: string;
    monthlyAmountMinor: number;
    createdBy: string;
    createdAt: Date;
    inviteToken: string;
    chargeDay: number;
  }): Promise<void> {
    this.rows.push({
      ...input,
      currency: 'USD',
      status: 'forming',
      memberCount: 1,
      membersRequired: MEMBERS_REQUIRED_TO_START,
      chargesBeginOn: null,
      members: [
        {
          userId: input.createdBy,
          joinedAt: input.createdAt,
          payoutPosition: null,
        },
      ],
    });
  }

  async listForUser(userId: string): Promise<CircleRecord[]> {
    return this.rows
      .filter((circle) =>
        circle.members.some((member) => member.userId === userId),
      )
      .map((circle) => this.record(circle));
  }

  async findForMember(
    userId: string,
    circleId: string,
  ): Promise<CircleDetailRecord | null> {
    const circle = this.rows.find((row) => row.id === circleId);

    if (!circle || !circle.members.some((member) => member.userId === userId)) {
      return null;
    }

    return this.detail(circle);
  }

  async findByInviteToken(token: string): Promise<CircleDetailRecord | null> {
    const circle = this.rows.find((row) => row.inviteToken === token);
    return circle ? this.detail(circle) : null;
  }

  async addMember(
    circleId: string,
    userId: string,
    joinedAt: Date,
  ): Promise<AddMemberResult> {
    const circle = this.rows.find((row) => row.id === circleId);

    if (!circle) {
      return 'missing';
    }

    if (circle.members.some((member) => member.userId === userId)) {
      return 'already';
    }

    if (circle.status !== 'forming') {
      return 'closed';
    }

    if (circle.members.length >= circle.membersRequired) {
      return 'full';
    }

    circle.members.push({ userId, joinedAt, payoutPosition: null });
    circle.memberCount = circle.members.length;
    return 'joined';
  }

  async updateSettings(
    circleId: string,
    userId: string,
    input: {
      name: string;
      monthlyAmountMinor: number;
      membersRequired: number;
    },
  ): Promise<CircleSettingsResult> {
    const circle = this.rows.find((row) => row.id === circleId);
    const gate = this.gate(circle, userId);

    if (gate !== 'creator' || !circle) {
      return gate === 'already' ? 'locked' : gate;
    }

    if (input.membersRequired < circle.members.length) {
      return 'too_small';
    }

    circle.name = input.name;
    circle.monthlyAmountMinor = input.monthlyAmountMinor;
    circle.membersRequired = input.membersRequired;
    return 'updated';
  }

  async lock(
    circleId: string,
    userId: string,
    orderOf: (userIds: string[]) => string[],
  ): Promise<CircleLockResult> {
    const circle = this.rows.find((row) => row.id === circleId);
    const gate = this.gate(circle, userId);

    if (gate !== 'creator' || !circle) {
      return gate;
    }

    if (circle.members.length !== circle.membersRequired) {
      return 'not_full';
    }

    const ids = circle.members.map((member) => member.userId);
    const ordered = orderOf(ids);

    if (!sameMembers(ids, ordered)) {
      throw new Error('Turn order must include every member once.');
    }

    for (const [index, memberId] of ordered.entries()) {
      const member = circle.members.find((item) => item.userId === memberId);

      if (member) {
        member.payoutPosition = index + 1;
      }
    }

    circle.status = 'active';
    return 'locked';
  }

  private gate(
    circle: Stored | undefined,
    userId: string,
  ): 'creator' | 'missing' | 'forbidden' | 'already' {
    if (!circle || !circle.members.some((member) => member.userId === userId)) {
      return 'missing';
    }

    if (circle.createdBy !== userId) {
      return 'forbidden';
    }

    if (circle.status !== 'forming') {
      return 'already';
    }

    return 'creator';
  }

  private record(circle: Stored): CircleRecord {
    return {
      id: circle.id,
      name: circle.name,
      monthlyAmountMinor: circle.monthlyAmountMinor,
      currency: circle.currency,
      status: circle.status,
      createdBy: circle.createdBy,
      createdAt: circle.createdAt,
      memberCount: circle.members.length,
      membersRequired: circle.membersRequired,
      chargeDay: circle.chargeDay,
      chargesBeginOn: circle.chargesBeginOn,
    };
  }

  private detail(circle: Stored): CircleDetailRecord {
    return {
      ...this.record(circle),
      inviteToken: circle.inviteToken,
      members: circle.members.map((member) => ({
        userId: member.userId,
        displayName: member.userId,
        username: member.userId,
        creator: member.userId === circle.createdBy,
        payoutPosition: member.payoutPosition,
        joinedAt: member.joinedAt,
      })),
    };
  }
}

function createService() {
  const circles = new MemoryCircles();
  const service = new CirclesService(circles);
  service.inviteTokens = () => 'invite-token-value-0123456789abcd';
  return { service, circles };
}

describe('CirclesService', () => {
  it('creates a forming circle with the creator as the only member', async () => {
    const { service } = createService();

    const circle = await service.create('user-1', {
      name: '  Thursday pot  ',
      monthlyAmountMinor: 5000,
    });

    expect(circle).toEqual({
      id: expect.any(String),
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
      currency: 'USD',
      status: 'forming',
      memberCount: 1,
      membersRequired: 6,
      viewerIsCreator: true,
    });
  });

  it('lists only the circles that belong to the caller', async () => {
    const { service } = createService();
    await service.create('user-1', {
      name: 'Mine',
      monthlyAmountMinor: 2000,
    });
    await service.create('user-2', {
      name: 'Theirs',
      monthlyAmountMinor: 2000,
    });

    const circles = await service.listForUser('user-1');

    expect(circles.map((circle) => circle.name)).toEqual(['Mine']);
  });

  it('rejects a blank name and an amount outside $1 to $100,000', async () => {
    const { service } = createService();

    await expect(
      service.create('user-1', { name: '   ', monthlyAmountMinor: 5000 }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);
    await expect(
      service.create('user-1', { name: 'Pot', monthlyAmountMinor: 99 }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);
    await expect(
      service.create('user-1', { name: 'Pot', monthlyAmountMinor: 50.5 }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);
  });

  it('returns the invite and leaves yield unrecorded for a member', async () => {
    const { service } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });

    const detail = await service.getForMember('user-1', created.id);

    expect(detail.inviteToken).toBe('invite-token-value-0123456789abcd');
    expect(detail.members).toEqual([
      {
        displayName: 'user-1',
        username: 'user-1',
        creator: true,
        payoutPosition: null,
        chargeApproved: false,
        contributionStatus: 'not_due',
      },
    ]);
    expect(detail.yield).toEqual({
      status: 'not_earning',
      earnedMinor: null,
      availableMinor: null,
    });
    await expect(
      service.getForMember('user-2', created.id),
    ).rejects.toBeInstanceOf(CircleNotFoundError);
  });

  it('adds a member from the invite and refuses a full or closed circle', async () => {
    const { service, circles } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });

    const joined = await service.join('user-2', {
      token: 'invite-token-value-0123456789abcd',
    });

    expect(joined.memberCount).toBe(2);
    expect(joined.viewerIsCreator).toBe(false);

    const again = await service.join('user-2', {
      token: 'invite-token-value-0123456789abcd',
    });
    expect(again.memberCount).toBe(2);

    const row = circles.rows[0];
    if (!row) {
      throw new Error('missing circle');
    }
    row.members = Array.from({ length: 6 }, (_, index) => ({
      userId: `member-${index}`,
      joinedAt: row.createdAt,
    }));
    row.memberCount = 6;
    await expect(
      service.join('user-9', { token: row.inviteToken }),
    ).rejects.toBeInstanceOf(CircleFullError);

    row.status = 'active';
    row.members = row.members.slice(0, 2);
    row.memberCount = 2;
    await expect(
      service.join('user-9', { token: row.inviteToken }),
    ).rejects.toBeInstanceOf(CircleClosedError);
    await expect(service.join('user-1', {})).rejects.toBeInstanceOf(
      InvalidInviteError,
    );
    await expect(
      service.join('user-1', { token: 'missing-token-value-0123456789' }),
    ).rejects.toBeInstanceOf(CircleNotFoundError);
  });

  it('lets the creator change the name and amount until the circle locks', async () => {
    const { service } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });

    const updated = await service.updateSettings('user-1', created.id, {
      name: 'Friday pot',
      monthlyAmountMinor: 7500,
      membersRequired: 6,
      chargeDay: 15,
    });

    expect(updated.name).toBe('Friday pot');
    expect(updated.monthlyAmountMinor).toBe(7500);
    expect(updated.membersRequired).toBe(6);
    expect(updated.status).toBe('forming');

    await expect(
      service.updateSettings('user-2', created.id, {
        name: 'Stolen',
        monthlyAmountMinor: 5000,
        membersRequired: 6,
        chargeDay: 15,
      }),
    ).rejects.toBeInstanceOf(CircleNotFoundError);

    await service.join('user-2', {
      token: 'invite-token-value-0123456789abcd',
    });
    await expect(
      service.updateSettings('user-2', created.id, {
        name: 'Stolen',
        monthlyAmountMinor: 5000,
        membersRequired: 6,
        chargeDay: 15,
      }),
    ).rejects.toBeInstanceOf(CircleForbiddenError);
  });

  it('assigns each member one random turn when the creator locks six members', async () => {
    const { service } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });
    const token = 'invite-token-value-0123456789abcd';

    for (let index = 2; index <= 6; index += 1) {
      await service.join(`user-${index}`, { token });
    }

    await expect(service.lock('user-2', created.id)).rejects.toBeInstanceOf(
      CircleForbiddenError,
    );
    service.orderMembers = (userIds) => [...userIds].reverse();

    const locked = await service.lock('user-1', created.id);

    expect(locked.status).toBe('active');
    expect(locked.members.map((member) => member.payoutPosition)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(locked.members.map((member) => member.username)).toEqual([
      'user-6',
      'user-5',
      'user-4',
      'user-3',
      'user-2',
      'user-1',
    ]);
    await expect(service.lock('user-1', created.id)).rejects.toBeInstanceOf(
      CircleLockedError,
    );
    await expect(
      service.updateSettings('user-1', created.id, {
        name: 'Changed',
        monthlyAmountMinor: 5000,
        membersRequired: 6,
        chargeDay: 15,
      }),
    ).rejects.toBeInstanceOf(CircleLockedError);
    await expect(service.join('user-7', { token })).rejects.toBeInstanceOf(
      CircleClosedError,
    );
  });

  it('refuses to lock a circle before every seat is filled', async () => {
    const { service } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });

    await expect(service.lock('user-1', created.id)).rejects.toThrow(
      'This circle locks when every seat is filled.',
    );
    await expect(service.lock('user-1', created.id)).rejects.toBeInstanceOf(
      CircleNotReadyError,
    );
  });

  it('lets the creator set 6 to 12 seats and locks only when they are filled', async () => {
    const { service } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });
    const token = 'invite-token-value-0123456789abcd';
    const settings = {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
      chargeDay: 15,
    };

    const shrunk = await service.updateSettings('user-1', created.id, {
      ...settings,
      membersRequired: 2,
    });

    expect(shrunk.membersRequired).toBe(2);

    const widened = await service.updateSettings('user-1', created.id, {
      ...settings,
      membersRequired: 8,
    });

    expect(widened.membersRequired).toBe(8);
    await expect(service.lock('user-1', created.id)).rejects.toBeInstanceOf(
      CircleNotReadyError,
    );
    await expect(
      service.updateSettings('user-1', created.id, {
        ...settings,
        membersRequired: 12,
      }),
    ).resolves.toMatchObject({ membersRequired: 12 });
    await service.updateSettings('user-1', created.id, {
      ...settings,
      membersRequired: 8,
    });
    await expect(
      service.updateSettings('user-1', created.id, {
        ...settings,
        membersRequired: 1,
      }),
    ).rejects.toThrow('A circle has 2 to 12 seats.');
    await expect(
      service.updateSettings('user-1', created.id, {
        ...settings,
        membersRequired: 13,
      }),
    ).rejects.toBeInstanceOf(InvalidCircleInputError);

    for (let index = 2; index <= 7; index += 1) {
      await service.join(`user-${index}`, { token });
    }

    await expect(
      service.updateSettings('user-1', created.id, {
        ...settings,
        membersRequired: 6,
      }),
    ).rejects.toThrow('There are already more members than those seats.');

    await service.join('user-8', { token });
    await expect(service.join('user-9', { token })).rejects.toBeInstanceOf(
      CircleFullError,
    );
    service.orderMembers = (userIds) => [...userIds].reverse();

    const locked = await service.lock('user-1', created.id);

    expect(locked.membersRequired).toBe(8);
    expect(locked.status).toBe('active');
    expect(locked.members.map((member) => member.username)).toEqual([
      'user-8',
      'user-7',
      'user-6',
      'user-5',
      'user-4',
      'user-3',
      'user-2',
      'user-1',
    ]);
  });

  it('locks a circle once its 2 seats are filled', async () => {
    const { service } = createService();
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });
    const token = 'invite-token-value-0123456789abcd';

    await service.updateSettings('user-1', created.id, {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
      membersRequired: 2,
      chargeDay: 15,
    });
    await expect(service.lock('user-1', created.id)).rejects.toBeInstanceOf(
      CircleNotReadyError,
    );
    await service.join('user-2', { token });
    await expect(service.join('user-3', { token })).rejects.toBeInstanceOf(
      CircleFullError,
    );

    const locked = await service.lock('user-1', created.id);

    expect(locked.membersRequired).toBe(2);
    expect(locked.status).toBe('active');
    expect(locked.members).toHaveLength(2);
  });

  it('stores the UTC creation day and leaves charges unstarted', async () => {
    const { service } = createService();
    service.clock = () => new Date('2026-01-31T00:00:00.000Z');
    const created = await service.create('user-1', {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
    });
    const detail = await service.getForMember('user-1', created.id);

    expect(detail.chargeDay).toBe(28);
    expect(detail.chargesBeginOn).toBeNull();
    expect(detail.potCollectedMinor).toBe(0);
    expect(detail.currentRound).toBeNull();
    expect(detail.viewerChargeApproved).toBe(false);

    const updated = await service.updateSettings('user-1', created.id, {
      name: 'Thursday pot',
      monthlyAmountMinor: 5000,
      membersRequired: 6,
    });

    expect(updated.chargeDay).toBe(28);
    expect(updated.chargesBeginOn).toBeNull();
  });
});
