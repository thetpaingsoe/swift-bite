import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DispatchesModule } from './dispatches/dispatches.module';
import { AllRpcExceptionsFilter } from './common/filters/all-rpc-exception.filter';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ConsulService } from './consul/consul.service';

async function bootstrap() {
  const app = await NestFactory.create(DispatchesModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  app.useGlobalFilters(new AllRpcExceptionsFilter());

  app.connectMicroservice<MicroserviceOptions>({
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
      noAck: false,
    },
  });
  await app.startAllMicroservices();
  logger.log('Rider service listening on rider_queue');

  const healthPort = configService.get<number>('SERVICE_PORT', 3011);
  await app.listen(healthPort);
  logger.log(`Rider health server running on port ${healthPort}`);

  app.enableShutdownHooks();
  await app.get(ConsulService).register();
}
bootstrap();
