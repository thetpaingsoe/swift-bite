import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { NeonHealthIndicator } from './neon.health';
import { RmqHealthIndicator } from './rmq.health';
import { DbService } from '../db/db.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TerminusModule,
    ConfigModule,
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
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [HealthController],
  providers: [NeonHealthIndicator, RmqHealthIndicator, DbService],
})
export class HealthModule {}
