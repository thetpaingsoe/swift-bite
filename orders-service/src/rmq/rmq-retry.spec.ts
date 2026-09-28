import { isRetryable } from './rmq-retry';

describe('isRetryable', () => {
  it('retries connection and timeout errnos', () => {
    for (const code of [
      'ECONNREFUSED',
      'ECONNRESET',
      'EPIPE',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ETIMEDOUT',
    ]) {
      expect(isRetryable(Object.assign(new Error(code), { code }))).toBe(true);
    }
  });

  it('retries transient Postgres codes', () => {
    for (const code of ['40001', '40P01', '53300', '57P01']) {
      expect(isRetryable(Object.assign(new Error(code), { code }))).toBe(true);
    }
  });

  it('sends permanent failures straight through', () => {
    expect(isRetryable(new Error('db down'))).toBe(false);
    expect(
      isRetryable(Object.assign(new Error('duplicate key'), { code: '23505' })),
    ).toBe(false);
    expect(isRetryable(null)).toBe(false);
    expect(isRetryable('boom')).toBe(false);
  });
});
