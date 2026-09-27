import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RmqHealthIndicator {
  constructor(
    private healthIndicatorService: HealthIndicatorService,
    private configService: ConfigService,
  ) {}

  pingCheck() {
    return this.healthIndicatorService.check('rmq').attempt(async () => {
      const client = ClientProxyFactory.create({
        transport: Transport.RMQ,
        options: {
          urls: [this.configService.get<string>('RABBITMQ_URL')!],
          queue: 'rider_queue',
          queueOptions: {
            durable:
              this.configService.get<string>('NODE_ENV') === 'production',
            arguments: {
              'x-dead-letter-exchange': '',
              'x-dead-letter-routing-key': 'rider_queue.dlq',
            },
          },
        },
      });
      await client.connect();
      await client.close();
    });
  }
}
