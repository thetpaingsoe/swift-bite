import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { OrdersClientService } from '../orders-client/orders-client.service';

@Injectable()
export class RmqHealthIndicator {
  constructor(
    private healthIndicatorService: HealthIndicatorService,
    private ordersClient: OrdersClientService,
  ) {}

  pingCheck() {
    return this.healthIndicatorService.check('rmq').attempt(async () => {
      await this.ordersClient.connect();
    });
  }
}
