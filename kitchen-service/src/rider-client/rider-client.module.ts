import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { RiderClientService } from './rider-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'RIDER_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: 'rider_queue',
            queueOptions: {
              durable: configService.get<string>('NODE_ENV') === 'production',
              arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': 'rider_queue.dlq',
              },
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [RiderClientService],
  exports: [RiderClientService],
})
export class RiderClientModule {}
