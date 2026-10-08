import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OrdersService } from './orders.service';

const menuItemId = '550e8400-e29b-41d4-a716-446655440000';
const mockItem = { id: menuItemId, name: 'Pizza', price: 1299 };

interface BreakerProbe {
  opened: boolean;
  closed: boolean;
  shutdown(): void;
}

function buildService(resetTimeoutMs = 30000) {
  const httpService = { get: jest.fn() };
  const discovery = {
    getServiceUrl: jest.fn().mockResolvedValue('http://item-service:3001'),
    invalidate: jest.fn(),
  };
  const config = {
    get: (key: string, fallback?: unknown) =>
      key === 'ITEM_BREAKER_RESET_TIMEOUT_MS' ? resetTimeoutMs : fallback,
  };
  const service = new OrdersService(
    {} as never,
    {} as never,
    httpService as never,
    discovery as never,
    config as never,
  );
  return { service, httpService, discovery };
}

function fetch(service: OrdersService): Promise<unknown> {
  return (
    service as unknown as { fetchItem(id: string): Promise<unknown> }
  ).fetchItem(menuItemId);
}

function breakerOf(service: OrdersService): BreakerProbe {
  return (service as unknown as { itemBreaker: BreakerProbe }).itemBreaker;
}

function networkDown() {
  return throwError(() => new Error('connect ECONNREFUSED'));
}

function serverError() {
  return throwError(() =>
    Object.assign(new Error('bad gateway'), { response: { status: 502 } }),
  );
}

describe('OrdersService item-service circuit breaker', () => {
  const created: OrdersService[] = [];

  afterEach(() => {
    for (const service of created.splice(0)) {
      breakerOf(service).shutdown();
    }
  });

  it('passes an explicit timeout and stays closed on success', async () => {
    const { service, httpService } = buildService();
    created.push(service);
    httpService.get.mockReturnValue(of({ data: mockItem }));

    await expect(fetch(service)).resolves.toEqual(mockItem);
    expect(httpService.get).toHaveBeenCalledWith(
      `http://item-service:3001/items/${menuItemId}`,
      expect.objectContaining({ timeout: 5000 }),
    );
    expect(breakerOf(service).closed).toBe(true);
  });

  it('opens after 5 failures and fails the 6th fast with 503', async () => {
    const { service, httpService } = buildService();
    created.push(service);
    httpService.get.mockImplementation(networkDown);

    for (let i = 0; i < 5; i += 1) {
      await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(breakerOf(service).opened).toBe(true);

    const callsBefore = httpService.get.mock.calls.length;
    const started = Date.now();
    await expect(fetch(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    const elapsed = Date.now() - started;

    await expect(fetch(service)).rejects.toThrow(/temporarily unavailable/i);
    expect(httpService.get.mock.calls.length).toBe(callsBefore);
    expect(elapsed).toBeLessThan(1000);
  });

  it('does not count 404s toward the breaker', async () => {
    const { service, httpService } = buildService();
    created.push(service);
    const notFound = Object.assign(new Error('not found'), {
      response: { status: 404 },
    });
    httpService.get.mockReturnValue(throwError(() => notFound));

    for (let i = 0; i < 5; i += 1) {
      await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(breakerOf(service).closed).toBe(true);
  });

  it('maps timeout exhaustion to NotFound like other transient failures', async () => {
    const { service, httpService } = buildService();
    created.push(service);
    const rxjsTimeout = Object.assign(new Error('Timeout has occurred'), {
      name: 'TimeoutError',
    });
    const opossumTimeout = Object.assign(new Error('Timed out after 20000ms'), {
      code: 'ETIMEDOUT',
    });
    httpService.get.mockImplementation(() => throwError(() => rxjsTimeout));
    await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    httpService.get.mockImplementation(() => throwError(() => opossumTimeout));
    await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    expect(breakerOf(service).closed).toBe(true);
  });

  it('half-opens after the reset timeout and closes on recovery', async () => {
    const { service, httpService } = buildService(100);
    created.push(service);
    httpService.get.mockImplementation(serverError);

    for (let i = 0; i < 5; i += 1) {
      await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(breakerOf(service).opened).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 250));
    httpService.get.mockImplementation(() => of({ data: mockItem }));

    await expect(fetch(service)).resolves.toEqual(mockItem);
    expect(breakerOf(service).closed).toBe(true);
  });

  it('logs open, half-open, and close transitions', async () => {
    const { service, httpService } = buildService(100);
    created.push(service);
    const lines: string[] = [];
    const logger = (
      service as unknown as { logger: { log(message: unknown): void } }
    ).logger;
    jest.spyOn(logger, 'log').mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
    httpService.get.mockImplementation(networkDown);

    for (let i = 0; i < 5; i += 1) {
      await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    httpService.get.mockImplementation(() => of({ data: mockItem }));
    await expect(fetch(service)).resolves.toEqual(mockItem);

    expect(lines.some((l) => l.includes('circuit open'))).toBe(true);
    expect(lines.some((l) => l.includes('circuit half-open'))).toBe(true);
    expect(lines.some((l) => l.includes('circuit closed'))).toBe(true);
  });

  it('creates no order row when the circuit is open', async () => {
    const { service, httpService } = buildService();
    created.push(service);
    const insert = jest.fn();
    (service as unknown as { dbService: unknown }).dbService = {
      db: { insert },
    };
    httpService.get.mockImplementation(networkDown);

    for (let i = 0; i < 5; i += 1) {
      await expect(fetch(service)).rejects.toBeInstanceOf(NotFoundException);
    }

    await expect(
      service.createOrder(
        {
          customerName: 'Jane',
          street: '1 Main St',
          area: 'Downtown',
          phone: '+959123456789',
          lines: [{ menuItemId, quantity: 1 }],
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(insert).not.toHaveBeenCalled();
  });
});
