import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lt } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { orders } from '../db/schema';
import {
  correlationStorage,
  resolveCorrelationId,
} from '../correlation/correlation.storage';

const REVIEW_AFTER_MIN = 10;
const REVIEW_INTERVAL_MS = 60000;

@Injectable()
export class ReviewService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dbService: DbService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }
    this.flagStaleReadyOrders().catch((error: Error) =>
      this.logger.error('Startup review sweep failed', error),
    );
    const interval = this.intervalMs();
    this.timer = setInterval(() => {
      this.flagStaleReadyOrders().catch((error: Error) =>
        this.logger.error('Review sweep failed', error),
      );
    }, interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async flagStaleReadyOrders(): Promise<number> {
    const afterMin = this.afterMin();
    const cutoff = new Date(Date.now() - afterMin * 60000);
    const stale = await this.dbService.db
      .select({
        id: orders.id,
        readyAt: orders.readyAt,
        correlationId: orders.correlationId,
      })
      .from(orders)
      .where(and(eq(orders.status, 'ready'), lt(orders.readyAt, cutoff)));

    let count = 0;

    for (const row of stale) {
      const { correlationId } = resolveCorrelationId(
        row.correlationId ?? undefined,
      );
      const flagged = await correlationStorage.run(
        { correlationId },
        async () => {
          const [updated] = await this.dbService.db
            .update(orders)
            .set({ status: 'needs_review' })
            .where(and(eq(orders.id, row.id), eq(orders.status, 'ready')))
            .returning({ id: orders.id });
          if (updated) {
            this.logger.warn(
              `Order ${row.id} ready since ${row.readyAt?.toISOString()} with no dispatch after ${afterMin}m, flagged needs_review`,
            );
            return true;
          }
          return false;
        },
      );
      if (flagged) {
        count += 1;
      }
    }

    return count;
  }

  private afterMin(): number {
    const value = Number(
      this.configService.get<number>(
        'RIDER_REVIEW_AFTER_MIN',
        REVIEW_AFTER_MIN,
      ),
    );
    return Number.isFinite(value) && value > 0 ? value : REVIEW_AFTER_MIN;
  }

  private intervalMs(): number {
    const value = Number(
      this.configService.get<number>(
        'RIDER_REVIEW_INTERVAL_MS',
        REVIEW_INTERVAL_MS,
      ),
    );
    return Number.isFinite(value) && value > 0 ? value : REVIEW_INTERVAL_MS;
  }

  private isEnabled(): boolean {
    const value = this.configService.get<unknown>('RIDER_REVIEW_ENABLED', true);
    return value !== false && value !== 'false';
  }
}
