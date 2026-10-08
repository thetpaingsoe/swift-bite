import {
  Module,
  RequestMethod,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from 'nestjs-pino';
import { CorrelationMiddleware } from '../correlation/correlation.middleware';
import { correlationStorage } from '../correlation/correlation.storage';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReconcileService } from './reconcile.service';
import { ReviewService } from './review.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Joi from 'joi';
import { DbService } from '../db/db.service';
import { AuthGuard } from '../auth/auth.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from '../health/health.module';
import { ConsulService } from '../consul/consul.service';
import { DiscoveryService } from '../consul/discovery.service';
import { KitchenClientModule } from '../kitchen-client/kitchen-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3000),
        RABBITMQ_URL: Joi.string().default('amqp://guest:guest@localhost:5672'),
        ITEM_SERVICE_URL: Joi.string().default('http://localhost:3001'),
        AUTH_SERVICE_URL: Joi.string().default('http://localhost:3000'),
        CONSUL_URL: Joi.string().default('http://localhost:8500'),
        SERVICE_NAME: Joi.string().default('orders-service'),
        SERVICE_ADDRESS: Joi.string().default('orders-service'),
        THROTTLE_LIMIT: Joi.number().default(10),
        THROTTLE_TTL_MS: Joi.number().default(60000),
        ITEM_BREAKER_RESET_TIMEOUT_MS: Joi.number().default(30000),
        RIDER_REVIEW_AFTER_MIN: Joi.number().default(10),
        RIDER_REVIEW_INTERVAL_MS: Joi.number().default(60000),
        RIDER_REVIEW_ENABLED: Joi.boolean().default(true),
        KITCHEN_RECONCILE_INTERVAL_MS: Joi.number().default(30000),
        KITCHEN_RECONCILE_ENABLED: Joi.boolean().default(true),
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
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>('ITEM_SERVICE_URL'),
        timeout: 5000,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('THROTTLE_TTL_MS', 60000),
            limit: configService.get<number>('THROTTLE_LIMIT', 10),
          },
        ],
        errorMessage: (_ctx, detail) =>
          `Too many orders, retry after ${detail?.timeToExpire ?? 60}s`,
      }),
    }),
    KitchenClientModule,
    HealthModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    ReconcileService,
    ReviewService,
    DbService,
    AuthGuard,
    ConsulService,
    DiscoveryService,
  ],
})
export class OrdersModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
