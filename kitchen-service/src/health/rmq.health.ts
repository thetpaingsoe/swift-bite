import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RiderClientService } from '../rider-client/rider-client.service';

@Injectable()
export class RmqHealthIndicator {
  constructor(
    private healthIndicatorService: HealthIndicatorService,
    private riderClient: RiderClientService,
  ) {}

  pingCheck() {
    return this.healthIndicatorService
      .check('rmq')
      .attempt(async () => {
        await this.riderClient.connect();
      });
  }
}
