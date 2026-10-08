import {
  Module,
  RequestMethod,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from 'nestjs-pino';
import { CorrelationMiddleware } from '../correlation/correlation.middleware';
import { correlationStorage } from '../correlation/correlation.storage';
import Joi from 'joi';
import { DbService } from '../db/db.service';
import { AdminGuard } from '../auth/admin.guard';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { HealthModule } from '../health/health.module';
import { ConsulService } from '../consul/consul.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3001),
        AUTH_SERVICE_URL: Joi.string().default('http://localhost:3000'),
        CONSUL_URL: Joi.string().default('http://localhost:8500'),
        SERVICE_NAME: Joi.string().default('item-service'),
        SERVICE_ADDRESS: Joi.string().default('item-service'),
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
        baseURL: configService.get<string>(
          'AUTH_SERVICE_URL',
          'http://localhost:3000',
        ),
        timeout: 5000,
      }),
      inject: [ConfigService],
    }),
    HealthModule,
  ],
  controllers: [ItemsController],
  providers: [ItemsService, DbService, AdminGuard, ConsulService],
})
export class ItemsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
