import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ChargesService } from '../application/charges.service';

const CHARGE_INTERVAL_MS = 60_000;

@Injectable()
export class ChargeScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly charges: ChargesService) {}

  onModuleInit(): void {
    void this.run();
    this.timer = setInterval(() => {
      void this.run();
    }, CHARGE_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async run(): Promise<void> {
    try {
      await this.charges.runDue(new Date());
    } catch {
      // A failed run is retried on the next minute. PayPal responses are not logged.
    }
  }
}
