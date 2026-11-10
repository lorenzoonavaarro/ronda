import { CreditService } from './credit.service';
import type { CreditRepository, StoredCreditEvent } from './ports';

class MemoryCredit implements CreditRepository {
  events: StoredCreditEvent[] = [];
  members = new Map<string, { circleId: string; circleName: string }[]>();
  seats = new Map<string, number>();
  private keys = new Set<string>();

  async insert(input: {
    id: string;
    userId: string;
    circleId: string;
    roundNumber: number;
    eventType: StoredCreditEvent['eventType'];
    points: number;
  }): Promise<boolean> {
    const key = `${input.userId}:${input.circleId}:${input.roundNumber}:${input.eventType}`;

    if (this.keys.has(key)) {
      return false;
    }

    this.keys.add(key);
    this.events.push({
      circleId: input.circleId,
      circleName: 'Sample',
      roundNumber: input.roundNumber,
      eventType: input.eventType,
      points: input.points,
      occurredOn: '2026-11-06',
    });
    return true;
  }

  async membersRequired(circleId: string): Promise<number | null> {
    return this.seats.get(circleId) ?? null;
  }

  async eventsForUser(): Promise<StoredCreditEvent[]> {
    return this.events;
  }

  async membershipsForUser(
    userId: string,
  ): Promise<{ circleId: string; circleName: string }[]> {
    return this.members.get(userId) ?? [];
  }
}

describe('CreditService', () => {
  it('adds 10 for an on-time round and keeps a one-round streak', async () => {
    const repo = new MemoryCredit();
    repo.seats.set('circle-1', 2);
    repo.members.set('user-1', [
      { circleId: 'circle-1', circleName: 'Sample' },
    ]);
    const service = new CreditService(repo);

    await service.recordPaid({
      userId: 'user-1',
      circleId: 'circle-1',
      roundNumber: 1,
    });
    await service.recordPaid({
      userId: 'user-1',
      circleId: 'circle-1',
      roundNumber: 1,
    });

    const credit = await service.read('user-1');

    expect(credit.points).toBe(10);
    expect(credit.memberships[0]?.streak).toBe(1);
    expect(credit.events).toHaveLength(1);
  });

  it('adds 20 when every round is paid and resets a streak after a miss', async () => {
    const repo = new MemoryCredit();
    repo.seats.set('circle-1', 2);
    repo.members.set('user-1', [
      { circleId: 'circle-1', circleName: 'Sample' },
    ]);
    const service = new CreditService(repo);

    await service.recordPaid({
      userId: 'user-1',
      circleId: 'circle-1',
      roundNumber: 1,
    });
    await service.recordPaid({
      userId: 'user-1',
      circleId: 'circle-1',
      roundNumber: 2,
    });

    expect((await service.read('user-1')).points).toBe(40);
    expect((await service.read('user-1')).memberships[0]?.streak).toBe(2);

    await service.recordMissed({
      userId: 'user-1',
      circleId: 'circle-1',
      roundNumber: 3,
    });

    const afterMiss = await service.read('user-1');

    expect(afterMiss.points).toBe(25);
    expect(afterMiss.memberships[0]?.streak).toBe(0);
  });

  it('records one pot default', async () => {
    const repo = new MemoryCredit();
    repo.members.set('user-1', [
      { circleId: 'circle-1', circleName: 'Sample' },
    ]);
    const service = new CreditService(repo);

    await service.recordPotDefault({ userId: 'user-1', circleId: 'circle-1' });
    await service.recordPotDefault({ userId: 'user-1', circleId: 'circle-1' });

    const credit = await service.read('user-1');

    expect(credit.points).toBe(-40);
    expect(credit.events[0]?.roundNumber).toBeNull();
  });
});
