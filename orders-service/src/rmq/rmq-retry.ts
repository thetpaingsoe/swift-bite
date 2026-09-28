export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 200;

const RETRYABLE_ERRNOS = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
]);

const RETRYABLE_PG_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '40001',
  '40P01',
  '53300',
  '53400',
  '53100',
  '55P03',
  '57P01',
  '57P14',
]);

const RETRYABLE_MESSAGE =
  /timed?\s?out|deadlock|serialization|connection|temporar|try again|too many (clients|connections)/i;

export function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as Record<string, unknown>;
  if (
    typeof record.code === 'string' &&
    (RETRYABLE_ERRNOS.has(record.code) || RETRYABLE_PG_CODES.has(record.code))
  ) {
    return true;
  }
  if (typeof record.errno === 'string' && RETRYABLE_ERRNOS.has(record.errno)) {
    return true;
  }
  return (
    typeof record.message === 'string' && RETRYABLE_MESSAGE.test(record.message)
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
