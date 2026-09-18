import { NestFactory } from '@nestjs/core';
import { AppModule } from './orders/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
  const port = configService.get<number>('PORT', 3000);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get<string>('RABBITMQ_URL')!],
      queue: 'orders_queue',
      queueOptions: {
        durable: configService.get<string>('NODE_ENV') === 'production',
      },
    },
  });
  await app.startAllMicroservices();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SwiftBite Orders')
      .setDescription('Order placement, tracking, and cancellation')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  logger.log(`Orders service running on port ${port}`);
  logger.log('Orders service listening on orders_queue');

  app.enableShutdownHooks();
  await app.get(ConsulService).register();
}
bootstrap();
