import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './tickets/app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { ConsulService } from './consul/consul.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get<string>('RABBITMQ_URL')!],
      queue: 'kitchen_queue',
      queueOptions: {
        durable: configService.get<string>('NODE_ENV') === 'production',
      },
    },
  });
  await app.startAllMicroservices();
  logger.log('Kitchen service listening on kitchen_queue');

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SwiftBite Kitchen')
      .setDescription('Ticket queue: accept, complete, reject')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api', app, document);

  const port = configService.get<number>('PORT', 3012);
  await app.listen(port);
  logger.log(`Kitchen service running on port ${port}`);

  app.enableShutdownHooks();
  await app.get(ConsulService).register();
}
bootstrap();
