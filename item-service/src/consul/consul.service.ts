import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostname } from 'os';

@Injectable()
export class ConsulService implements OnModuleDestroy {
  private readonly logger = new Logger(ConsulService.name);
  private readonly serviceId: string;
  private registered = false;
  private heartbeat?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {
    const name = this.configService.get<string>(
      'SERVICE_NAME',
      'item-service',
    );
    this.serviceId = `${name}-${hostname()}`;
  }

  private get baseUrl(): string {
    return this.configService.get<string>(
      'CONSUL_URL',
      'http://localhost:8500',
    );
  }

  async register(): Promise<void> {
    const ok = await this.sendRegistration();
    if (ok) {
      this.registered = true;
      this.logger.log(`Registered ${this.serviceId} with Consul`);
    }
    this.startHeartbeat();
  }

  private buildPayload() {
    const name = this.configService.get<string>(
      'SERVICE_NAME',
      'item-service',
    );
    const port =
      this.configService.get<number>('SERVICE_PORT') ??
      this.configService.get<number>('PORT', 3001);
    const address = this.configService.get<string>(
      'SERVICE_ADDRESS',
      name,
    );
    return {
      ID: this.serviceId,
      Name: name,
      Address: address,
      Port: port,
      Check: {
        HTTP: `http://${hostname()}:${port}/health`,
        Interval: '10s',
        DeregisterCriticalServiceAfter: '1m',
      },
    };
  }

  private async sendRegistration(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/agent/service/register`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildPayload()),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        throw new Error(`Consul responded ${res.status}`);
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `Consul registration skipped: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeat) {
      return;
    }
    this.heartbeat = setInterval(() => {
      void this.sendRegistration().then((ok) => {
        if (ok) {
          this.registered = true;
        }
      });
    }, 60_000);
    this.heartbeat.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
    if (!this.registered) {
      return;
    }
    try {
      await fetch(
        `${this.baseUrl}/v1/agent/service/deregister/${this.serviceId}`,
        { method: 'PUT', signal: AbortSignal.timeout(5000) },
      );
      this.logger.log(`Deregistered ${this.serviceId} from Consul`);
    } catch (error) {
      this.logger.warn(
        `Consul deregistration failed: ${(error as Error).message}`,
      );
    }
  }
}
