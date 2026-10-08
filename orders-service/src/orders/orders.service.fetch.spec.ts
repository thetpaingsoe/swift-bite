import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OrdersService } from './orders.service';

describe('OrdersService fetchItem retry wrapper', () => {
  const menuItemId = '550e8400-e29b-41d4-a716-446655440000';
  const mockItem = { id: menuItemId, name: 'Pizza', price: 1299 };
  let service: OrdersService;
  let httpService: { get: jest.Mock };
  let discovery: { getServiceUrl: jest.Mock; invalidate: jest.Mock };

  beforeEach(() => {
    httpService = { get: jest.fn() };
    discovery = {
      getServiceUrl: jest.fn().mockResolvedValue('http://item-service:3001'),
      invalidate: jest.fn(),
    };
    const config = { get: (_key: string, fallback?: string) => fallback };
    service = new OrdersService(
      {} as never,
      {} as never,
      httpService as never,
      discovery as never,
      config as never,
    );
  });

  function fetch(): Promise<unknown> {
    return (
      service as unknown as { fetchItem(id: string): Promise<unknown> }
    ).fetchItem(menuItemId);
  }

  it('retries a one-off flake then succeeds', async () => {
    httpService.get
      .mockReturnValueOnce(throwError(() => new Error('socket hang up')))
      .mockReturnValueOnce(of({ data: mockItem }));

    await expect(fetch()).resolves.toEqual(mockItem);
    expect(httpService.get).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const notFound = Object.assign(new Error('not found'), {
      response: { status: 404 },
    });
    httpService.get.mockReturnValue(throwError(() => notFound));

    await expect(fetch()).rejects.toBeInstanceOf(NotFoundException);
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('gives up cleanly after max retries on persistent failure', async () => {
    const serverError = Object.assign(new Error('bad gateway'), {
      response: { status: 502 },
    });
    httpService.get.mockReturnValue(throwError(() => serverError));

    await expect(fetch()).rejects.toBeInstanceOf(NotFoundException);
    expect(httpService.get).toHaveBeenCalledTimes(3);
    expect(discovery.getServiceUrl).toHaveBeenCalledTimes(3);
  });

  it('gives up cleanly when the network stays down', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED')),
    );

    await expect(fetch()).rejects.toBeInstanceOf(NotFoundException);
    expect(httpService.get).toHaveBeenCalledTimes(3);
    expect(discovery.invalidate).toHaveBeenCalled();
  });
});
