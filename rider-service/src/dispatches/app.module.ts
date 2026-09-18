import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggerModule } from 'nestjs-pino';
import Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbService } from '../db/db.service';
import { ConsulService } from '../consul/consul.service';
import { correlationStorage } from '../correlation/correlation.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        PORT: Joi.number().default(3000),
        RABBITMQ_URL: Joi.string().default('amqp://guest:guest@localhost:5672'),
        CONSUL_URL: Joi.string().default('http://localhost:8500'),
        SERVICE_NAME: Joi.string().default('rider-service'),
        SERVICE_ADDRESS: Joi.string().default('rider-service'),
        SERVICE_PORT: Joi.number().default(3011),
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
    ClientsModule.registerAsync([
      {
        name: 'ORDERS_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')!],
            queue: 'orders_queue',
            queueOptions: {
              durable: configService.get<string>('NODE_ENV') === 'production',
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService, DbService, ConsulService],
})
export class AppModule {}
