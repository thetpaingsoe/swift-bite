import { Module, RequestMethod } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { RiderClientModule } from '../rider-client/rider-client.module';
import { OrdersClientModule } from '../orders-client/orders-client.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import Joi from 'joi';
import { TicketsService } from './tickets.service';
import { DbService } from '../db/db.service';
import { ConsulService } from '../consul/consul.service';
import { HealthModule } from '../health/health.module';
import { DlqService } from '../dlq/dlq.service';
import { KitchenGuard } from '../auth/kitchen.guard';
import { correlationStorage } from '../correlation/correlation.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3012),
        RABBITMQ_URL: Joi.string().default('amqp://guest:guest@localhost:5672'),
        AUTH_SERVICE_URL: Joi.string().default('http://localhost:3000'),
        CONSUL_URL: Joi.string().default('http://localhost:8500'),
        SERVICE_NAME: Joi.string().default('kitchen-service'),
        SERVICE_ADDRESS: Joi.string().default('kitchen-service'),
        SERVICE_PORT: Joi.number().default(3012),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
      }),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const isProd = nodeEnv === 'production';
        return {
          pinoHttp: {
            mixin: () => {
              const store = correlationStorage.getStore();
              return store ? { correlationId: store.correlationId } : {};
            },
            level: nodeEnv === 'test' ? 'silent' : isProd ? 'info' : 'debug',
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true },
                },
            redact: [
              'req.headers.authorization',
              '*.password',
              '*.passwordHash',
            ],
          },
          exclude: [
            { method: RequestMethod.ALL, path: 'health' },
            { method: RequestMethod.ALL, path: 'health/readiness' },
          ],
        };
      },
    }),
    RiderClientModule,
    OrdersClientModule,
    HealthModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService, DbService, ConsulService, KitchenGuard, DlqService],
})
export class TicketsModule {}
