import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

const RECONCILE_INTERVAL_MS = 30000;

@Injectable()
export class ReconcileService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconcileService.name);
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }
    this.sweep();
    const interval = this.intervalMs();
    this.timer = setInterval(() => this.sweep(), interval);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private sweep() {
    if (this.sweeping) {
      this.logger.warn(
        'Kitchen reconcile sweep already in flight, skipping tick',
      );
      return;
    }
    this.sweeping = true;
    this.appService
      .reconcileUnsentOrders()
      .catch((error: Error) =>
        this.logger.error('Kitchen reconcile sweep failed', error),
      )
      .finally(() => {
        this.sweeping = false;
      });
  }

  private intervalMs(): number {
    const value = Number(
      this.configService.get<number>(
        'KITCHEN_RECONCILE_INTERVAL_MS',
        RECONCILE_INTERVAL_MS,
      ),
    );
    return Number.isFinite(value) && value > 0 ? value : RECONCILE_INTERVAL_MS;
  }

  private isEnabled(): boolean {
    const value = this.configService.get<unknown>(
      'KITCHEN_RECONCILE_ENABLED',
      true,
    );
    return value !== false && value !== 'false';
  }
}
