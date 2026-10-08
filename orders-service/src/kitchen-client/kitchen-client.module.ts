import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KitchenClientService } from './kitchen-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KITCHEN_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: 'kitchen_queue',
            queueOptions: {
              durable: configService.get<string>('NODE_ENV') === 'production',
              arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': 'kitchen_queue.dlq',
              },
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KitchenClientService],
  exports: [KitchenClientService],
})
export class KitchenClientModule {}
