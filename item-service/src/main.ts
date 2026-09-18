import { NestFactory } from '@nestjs/core';
import { AppModule } from './items/items.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConsulService } from './consul/consul.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SwiftBite Items')
      .setDescription('Menu categories and items')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  const logger = new NestLogger('Bootstrap');
  logger.log(`Item service is running on localhost:${port}`);

  await app.get(ConsulService).register();

  app.enableShutdownHooks();
}
bootstrap();
