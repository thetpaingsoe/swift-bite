import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { throwError } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { AuthGuard } from '../auth/auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbService } from '../db/db.service';
import { DiscoveryService } from '../consul/discovery.service';

describe('POST /orders circuit breaker body (SPEC-4.4)', () => {
  let app: INestApplication<App>;
  let httpService: { get: jest.Mock };

  const orderBody = {
    customerName: 'Breaker Test',
    lines: [
      { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1 },
    ],
    street: '123 Main St',
    area: 'Downtown',
    phone: '+959123456789',
  };

  function postOrder() {
    return request(app.getHttpServer()).post('/orders').send(orderBody);
  }

  beforeAll(async () => {
    httpService = { get: jest.fn() };
    const discovery = {
      getServiceUrl: jest.fn().mockResolvedValue('http://item-service:3001'),
      invalidate: jest.fn(),
    };
    const config = {
      get: (_key: string, fallback?: unknown) => fallback,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: 'KITCHEN_SERVICE', useValue: {} },
        { provide: DbService, useValue: {} },
        { provide: HttpService, useValue: httpService },
        { provide: DiscoveryService, useValue: discovery },
        { provide: ConfigService, useValue: config },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const service = moduleFixture.get<AppService>(AppService);
    (service as unknown as { dbService: unknown }).dbService = {} as never;

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the 503 body buyers see once the circuit opens', async () => {
    httpService.get.mockImplementation(() =>
      throwError(() => new Error('connect ECONNREFUSED')),
    );

    for (let i = 0; i < 5; i += 1) {
      await postOrder().expect(404);
    }

    const res = await postOrder().expect(503);
    const body = res.body as {
      statusCode?: number;
      message?: unknown;
      error?: string;
    };
    expect(body.statusCode).toBe(503);
    expect(String(body.message)).toMatch(/temporarily unavailable/i);
  }, 30000);
});
