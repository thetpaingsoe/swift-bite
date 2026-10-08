import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger as NestLogger } from '@nestjs/common';
import { buildValidationPipe } from './common/pipes/validation.pipe';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConsulService } from './consul/consul.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(buildValidationPipe());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SwiftBite Auth')
      .setDescription('User registration, login, and token verification')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api', app, document);

  await app.listen(port);
  const logger = new NestLogger('Bootstrap');
  logger.log(`Auth service is running on localhost:${port}`);

  app.enableShutdownHooks();
  await app.get(ConsulService).register();
}
bootstrap();
