import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { KitchenClientService } from '../kitchen-client/kitchen-client.service';

@Injectable()
export class RmqHealthIndicator {
  constructor(
    private healthIndicatorService: HealthIndicatorService,
    private kitchenClient: KitchenClientService,
  ) {}

  pingCheck() {
    return this.healthIndicatorService
      .check('rmq')
      .attempt(async () => {
        await this.kitchenClient.connect();
      });
  }
}
