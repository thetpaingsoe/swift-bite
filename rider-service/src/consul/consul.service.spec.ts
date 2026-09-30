import { hostname } from 'os';
import { ConsulService } from './consul.service';

function stubConfig(values: Record<string, string | number> = {}) {
  return {
    get: jest.fn((key: string, fallback?: string | number) =>
      key in values ? values[key] : fallback,
    ),
  } as any;
}

describe('ConsulService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('PUTs the service definition to the agent register endpoint', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = new ConsulService(
        stubConfig({ SERVICE_PORT: 3011, CONSUL_URL: 'http://consul:8500' }),
      );

      await service.register();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        'http://consul:8500/v1/agent/service/register',
      );
      expect(init.method).toBe('PUT');
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        Name: 'rider-service',
        Address: 'rider-service',
        Port: 3011,
      });
      expect(body.ID).toMatch(/^rider-service-.+/);
      expect(body.Check).toMatchObject({
        HTTP: `http://${hostname()}:3011/health`,
        Interval: '10s',
      });
      await service.onModuleDestroy();
    });

    it('prefers SERVICE_PORT over PORT when set', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = new ConsulService(
        stubConfig({ PORT: 3000, SERVICE_PORT: 3011 }),
      );

      await service.register();

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.Port).toBe(3011);
      expect(body.Check.HTTP).toBe(`http://${hostname()}:3011/health`);
      await service.onModuleDestroy();
    });

    it('falls back to localhost defaults when config is missing', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = new ConsulService(stubConfig());

      await service.register();

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        'http://localhost:8500/v1/agent/service/register',
      );
      await service.onModuleDestroy();
    });

    it('does not throw when Consul is unreachable', async () => {
      fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));
      const service = new ConsulService(stubConfig());

      await expect(service.register()).resolves.toBeUndefined();
      await service.onModuleDestroy();
    });

    it('does not throw on non-OK status', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
      const service = new ConsulService(stubConfig());

      await expect(service.register()).resolves.toBeUndefined();
      await service.onModuleDestroy();
    });
  });

  describe('onModuleDestroy', () => {
    it('deregisters with the same ID after a successful register', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = new ConsulService(stubConfig());
      await service.register();
      const [registerUrl, registerInit] = fetchSpy.mock.calls[0];
      const id = JSON.parse(registerInit.body).ID;
      expect(registerUrl).toContain('/v1/agent/service/register');

      fetchSpy.mockClear();
      await service.onModuleDestroy();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        `http://localhost:8500/v1/agent/service/deregister/${id}`,
      );
      expect(init.method).toBe('PUT');
    });

    it('does nothing when register never succeeded', async () => {
      fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));
      const service = new ConsulService(stubConfig());
      await service.register();

      fetchSpy.mockClear();
      await service.onModuleDestroy();

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('does not throw when deregistration fails', async () => {
      fetchSpy.mockResolvedValue({ ok: true } as Response);
      const service = new ConsulService(stubConfig());
      await service.register();

      fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
